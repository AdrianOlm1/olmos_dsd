import { getDatabase } from '../db/database';
import { v4 as uuid } from 'uuid';

/**
 * All operations work locally against SQLite.
 * Data is queued for sync when connectivity is available.
 */

// ─── Invoice Operations ────────────────────────────────────────

interface InvoiceLineInput {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  lotNumber?: string;
  promotionId?: string;
}

export async function createLocalInvoice(data: {
  customerId: string;
  locationId?: string;
  routeId?: string;
  lines: InvoiceLineInput[];
  notes?: string;
}) {
  const db = await getDatabase();
  const localId = uuid();
  const now = new Date().toISOString();

  const subtotal = data.lines.reduce((sum, l) => sum + (l.unitPrice - l.discount) * l.quantity, 0);
  const taxAmount = 0;
  const totalAmount = Number((subtotal + taxAmount).toFixed(2));

  await db.runAsync(`
    INSERT INTO invoices (local_id, customer_id, location_id, route_id, status, subtotal, tax_amount, total_amount, amount_paid, balance_due, notes, synced, created_at)
    VALUES (?, ?, ?, ?, 'COMPLETED', ?, ?, ?, 0, ?, ?, 0, ?)
  `, [localId, data.customerId, data.locationId ?? null, data.routeId ?? null, subtotal, taxAmount, totalAmount, totalAmount, data.notes ?? null, now]);

  for (const line of data.lines) {
    const lineTotal = Number(((line.unitPrice - line.discount) * line.quantity).toFixed(2));
    await db.runAsync(`
      INSERT INTO invoice_lines (local_id, invoice_local_id, product_id, quantity, unit_price, discount, line_total, tax_amount, lot_number, promotion_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `, [uuid(), localId, line.productId, line.quantity, line.unitPrice, line.discount, lineTotal, line.lotNumber ?? null, line.promotionId ?? null]);

    // Deduct from truck inventory
    await db.runAsync(`
      UPDATE truck_inventory
      SET quantity_current = quantity_current - ?, quantity_sold = quantity_sold + ?
      WHERE product_id = ? AND route_date = date('now')
    `, [line.quantity, line.quantity, line.productId]);
  }

  return { localId, totalAmount, invoiceNumber: `LOCAL-${localId.slice(0, 8).toUpperCase()}` };
}

export async function signInvoice(localId: string, signatureData: string, signedByName: string) {
  const db = await getDatabase();
  await db.runAsync(`
    UPDATE invoices SET signature_data = ?, signed_by_name = ?, delivered_at = ?, status = 'DELIVERED'
    WHERE local_id = ?
  `, [signatureData, signedByName, new Date().toISOString(), localId]);
}

export async function refuseInvoiceLines(localId: string, lineRefusals: { lineLocalId: string; reason: string }[]) {
  const db = await getDatabase();

  for (const refusal of lineRefusals) {
    const line = await db.getFirstAsync<any>(
      'SELECT * FROM invoice_lines WHERE local_id = ?', [refusal.lineLocalId]
    );

    if (line) {
      await db.runAsync(
        'UPDATE invoice_lines SET refused = 1, refused_reason = ? WHERE local_id = ?',
        [refusal.reason, refusal.lineLocalId]
      );

      // Return to truck inventory
      await db.runAsync(`
        UPDATE truck_inventory
        SET quantity_current = quantity_current + ?, quantity_sold = quantity_sold - ?
        WHERE product_id = ? AND route_date = date('now')
      `, [line.quantity, line.quantity, line.product_id]);
    }
  }

  // Check if all lines refused
  const allLines = await db.getAllAsync<any>(
    'SELECT * FROM invoice_lines WHERE invoice_local_id = ?', [localId]
  );
  const allRefused = allLines.every(l => l.refused);

  await db.runAsync(
    'UPDATE invoices SET status = ? WHERE local_id = ?',
    [allRefused ? 'REFUSED' : 'PARTIALLY_REFUSED', localId]
  );
}

// ─── Payment Operations ────────────────────────────────────────

export async function collectLocalPayment(data: {
  invoiceLocalId: string;
  amount: number;
  method: 'CASH' | 'CHECK' | 'ON_ACCOUNT';
  checkNumber?: string;
  reference?: string;
}) {
  const db = await getDatabase();
  const localId = uuid();

  await db.runAsync(`
    INSERT INTO payments (local_id, invoice_local_id, amount, method, check_number, reference, collected_at, synced)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0)
  `, [localId, data.invoiceLocalId, data.amount, data.method, data.checkNumber ?? null, data.reference ?? null, new Date().toISOString()]);

  // Update invoice balance
  await db.runAsync(`
    UPDATE invoices SET amount_paid = amount_paid + ?, balance_due = balance_due - ?
    WHERE local_id = ?
  `, [data.amount, data.amount, data.invoiceLocalId]);

  return { localId };
}

// ─── Credit Operations ─────────────────────────────────────────

export async function createLocalCredit(data: {
  customerId: string;
  reason: string;
  notes?: string;
  signatureData?: string;
  lines: {
    productId: string;
    quantity: number;
    unitPrice: number;
    condition: string;
    lotNumber?: string;
  }[];
}) {
  const db = await getDatabase();
  const localId = uuid();
  const totalAmount = data.lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0);

  await db.runAsync(`
    INSERT INTO credit_memos (local_id, customer_id, reason, total_amount, notes, signature_data, synced, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `, [localId, data.customerId, data.reason, totalAmount, data.notes ?? null, data.signatureData ?? null, new Date().toISOString()]);

  for (const line of data.lines) {
    const lineTotal = Number((line.quantity * line.unitPrice).toFixed(2));
    await db.runAsync(`
      INSERT INTO credit_lines (local_id, credit_local_id, product_id, quantity, unit_price, line_total, condition, lot_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [uuid(), localId, line.productId, line.quantity, line.unitPrice, lineTotal, line.condition, line.lotNumber ?? null]);

    // Add resalable items back to truck
    if (line.condition === 'RESALABLE') {
      await db.runAsync(`
        UPDATE truck_inventory
        SET quantity_current = quantity_current + ?, quantity_returned = quantity_returned + ?
        WHERE product_id = ? AND route_date = date('now')
      `, [line.quantity, line.quantity, line.productId]);
    }
  }

  return { localId, totalAmount };
}

// ─── Route Operations ──────────────────────────────────────────

export async function getLocalRoute() {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const route = await db.getFirstAsync<any>(
    'SELECT * FROM routes WHERE route_date = ?', [today]
  );

  if (!route) return null;

  const stops = await db.getAllAsync<any>(
    'SELECT * FROM route_stops WHERE route_id = ? ORDER BY stop_order', [route.id]
  );

  return { ...route, stops };
}

export async function arriveAtStop(stopId: string) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE route_stops SET status = ?, actual_arrival = ? WHERE id = ?',
    ['IN_PROGRESS', new Date().toISOString(), stopId]
  );
}

export async function completeStop(stopId: string, routeId: string) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE route_stops SET status = ?, departed_at = ? WHERE id = ?',
    ['COMPLETED', new Date().toISOString(), stopId]
  );
  await db.runAsync(
    'UPDATE routes SET completed_stops = completed_stops + 1 WHERE id = ?',
    [routeId]
  );
}

export async function skipStop(stopId: string, reason: string) {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE route_stops SET status = ?, no_service_reason = ? WHERE id = ?',
    ['NO_SERVICE', reason, stopId]
  );
}

// ─── Truck Inventory ───────────────────────────────────────────

export async function getTruckInventory() {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  return db.getAllAsync<any>(`
    SELECT ti.*, p.name as product_name, p.sku, p.upc, p.unit_of_measure
    FROM truck_inventory ti
    JOIN products p ON p.id = ti.product_id
    WHERE ti.route_date = ?
    ORDER BY p.name
  `, [today]);
}

// ─── Local Pricing ─────────────────────────────────────────────

export async function resolveLocalPrice(productId: string, customerId: string, quantity: number = 1) {
  const db = await getDatabase();

  // 1. Customer-specific price
  const customerPrice = await db.getFirstAsync<any>(`
    SELECT price FROM customer_prices
    WHERE customer_id = ? AND product_id = ?
      AND effective_from <= date('now')
      AND (effective_to IS NULL OR effective_to >= date('now'))
    ORDER BY effective_from DESC LIMIT 1
  `, [customerId, productId]);

  if (customerPrice) {
    return { unitPrice: customerPrice.price, source: 'customer', effectivePrice: customerPrice.price };
  }

  // 2. Check chain price via customer
  const customer = await db.getFirstAsync<any>(
    'SELECT chain_id FROM customers WHERE id = ?', [customerId]
  );

  // 3. Quantity-based price levels
  const priceLevel = await db.getFirstAsync<any>(`
    SELECT price FROM price_levels
    WHERE product_id = ? AND min_quantity <= ?
      AND effective_from <= date('now')
      AND (effective_to IS NULL OR effective_to >= date('now'))
    ORDER BY min_quantity DESC LIMIT 1
  `, [productId, quantity]);

  if (priceLevel) {
    return { unitPrice: priceLevel.price, source: 'level', effectivePrice: priceLevel.price };
  }

  // 4. Base price
  const product = await db.getFirstAsync<any>(
    'SELECT base_price FROM products WHERE id = ?', [productId]
  );

  return {
    unitPrice: product?.base_price || 0,
    source: 'base',
    effectivePrice: product?.base_price || 0,
  };
}

// ─── Delivery Logs ─────────────────────────────────────────────

export async function logDeliveryEvent(locationId: string, action: string, metadata?: any, coords?: { latitude: number; longitude: number }) {
  const db = await getDatabase();
  await db.runAsync(`
    INSERT INTO delivery_logs (id, location_id, action, metadata, latitude, longitude, synced, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `, [uuid(), locationId, action, metadata ? JSON.stringify(metadata) : null, coords?.latitude ?? null, coords?.longitude ?? null, new Date().toISOString()]);
}

// ─── Query Helpers ─────────────────────────────────────────────

export async function getLocalCustomers() {
  const db = await getDatabase();
  return db.getAllAsync<any>('SELECT * FROM customers ORDER BY name');
}

export async function getLocalProducts(search?: string) {
  const db = await getDatabase();
  if (search) {
    return db.getAllAsync<any>(
      'SELECT * FROM products WHERE name LIKE ? OR sku LIKE ? OR upc LIKE ? ORDER BY name',
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );
  }
  return db.getAllAsync<any>('SELECT * FROM products ORDER BY name');
}

export async function getLocalInvoices() {
  const db = await getDatabase();
  return db.getAllAsync<any>(`
    SELECT i.*, c.name as customer_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    ORDER BY i.created_at DESC
  `);
}

export async function getLocalInvoiceDetails(localId: string) {
  const db = await getDatabase();
  const invoice = await db.getFirstAsync<any>(`
    SELECT i.*, c.name as customer_name
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.local_id = ?
  `, [localId]);

  const lines = await db.getAllAsync<any>(`
    SELECT il.*, p.name as product_name, p.sku
    FROM invoice_lines il
    JOIN products p ON p.id = il.product_id
    WHERE il.invoice_local_id = ?
  `, [localId]);

  const payments = await db.getAllAsync<any>(
    'SELECT * FROM payments WHERE invoice_local_id = ?', [localId]
  );

  return { ...invoice, lines, payments };
}

export async function getCustomerInsights(customerId: string) {
  const db = await getDatabase();
  return db.getFirstAsync<any>(
    'SELECT * FROM customer_insights WHERE customer_id = ?', [customerId]
  );
}

export async function getDailySummary() {
  const db = await getDatabase();
  const today = new Date().toISOString().split('T')[0];

  const invoiceStats = await db.getFirstAsync<any>(`
    SELECT
      COUNT(*) as invoice_count,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(SUM(amount_paid), 0) as total_collected
    FROM invoices
    WHERE date(created_at) = ?
  `, [today]);

  const creditStats = await db.getFirstAsync<any>(`
    SELECT
      COUNT(*) as credit_count,
      COALESCE(SUM(total_amount), 0) as total_credits
    FROM credit_memos
    WHERE date(created_at) = ?
  `, [today]);

  const routeStats = await db.getFirstAsync<any>(`
    SELECT
      COALESCE(SUM(CASE WHEN rs.status = 'COMPLETED' THEN 1 ELSE 0 END), 0) as completed_stops,
      COALESCE(SUM(CASE WHEN rs.status IN ('SKIPPED', 'NO_SERVICE') THEN 1 ELSE 0 END), 0) as skipped_stops,
      COUNT(*) as total_stops
    FROM route_stops rs
    JOIN routes r ON r.id = rs.route_id
    WHERE r.route_date = ?
  `, [today]);

  return {
    invoices: Number(invoiceStats?.invoice_count) || 0,
    revenue: Number(invoiceStats?.total_revenue) || 0,
    collected: Number(invoiceStats?.total_collected) || 0,
    credits: Number(creditStats?.credit_count) || 0,
    creditAmount: Number(creditStats?.total_credits) || 0,
    stopsCompleted: Number(routeStats?.completed_stops) || 0,
    stopsSkipped: Number(routeStats?.skipped_stops) || 0,
    totalStops: Number(routeStats?.total_stops) || 0,
  };
}
