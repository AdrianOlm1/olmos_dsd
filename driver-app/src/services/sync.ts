import { getDatabase } from '../db/database';
import { api, getDeviceId } from './api';

/**
 * Offline sync engine.
 *
 * Strategy:
 * 1. Collect all unsynced local records (invoices, payments, credits, logs)
 * 2. Send them to the server in one batch
 * 3. Receive server-side updates (products, customers, prices, routes)
 * 4. Apply server updates to local SQLite
 * 5. Mark local records as synced
 */
export async function performSync(): Promise<{
  uploaded: { invoices: number; payments: number; credits: number };
  downloaded: { products: number; customers: number; routes: number };
  errors: string[];
}> {
  const db = await getDatabase();
  const deviceId = getDeviceId();
  const errors: string[] = [];

  // Get last sync timestamp
  const syncMeta = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM sync_meta WHERE key = ?', ['last_sync']
  );
  const lastSyncTimestamp = syncMeta?.value || '2000-01-01T00:00:00.000Z';

  // Gather unsynced invoices
  const unsyncedInvoices = await db.getAllAsync<any>(
    'SELECT * FROM invoices WHERE synced = 0'
  );
  const invoicePayloads = [];
  for (const inv of unsyncedInvoices) {
    const lines = await db.getAllAsync<any>(
      'SELECT * FROM invoice_lines WHERE invoice_local_id = ?', [inv.local_id]
    );
    invoicePayloads.push({
      localId: inv.local_id,
      customerId: inv.customer_id,
      locationId: inv.location_id,
      driverId: inv.driver_id || '',
      routeId: inv.route_id,
      lines: lines.map(l => ({
        productId: l.product_id,
        quantity: l.quantity,
        lotNumber: l.lot_number,
        overridePrice: l.unit_price,
      })),
      notes: inv.notes,
      signatureData: inv.signature_data,
      signedByName: inv.signed_by_name,
    });
  }

  // Gather unsynced payments
  const unsyncedPayments = await db.getAllAsync<any>(
    'SELECT * FROM payments WHERE synced = 0'
  );
  const paymentPayloads = unsyncedPayments.map(p => ({
    localId: p.local_id,
    invoiceId: p.invoice_local_id, // Will need server ID mapping
    amount: p.amount,
    method: p.method,
    checkNumber: p.check_number,
    reference: p.reference,
  }));

  // Gather unsynced credits
  const unsyncedCredits = await db.getAllAsync<any>(
    'SELECT * FROM credit_memos WHERE synced = 0'
  );
  const creditPayloads = [];
  for (const cr of unsyncedCredits) {
    const lines = await db.getAllAsync<any>(
      'SELECT * FROM credit_lines WHERE credit_local_id = ?', [cr.local_id]
    );
    creditPayloads.push({
      localId: cr.local_id,
      customerId: cr.customer_id,
      reason: cr.reason,
      notes: cr.notes,
      signatureData: cr.signature_data,
      lines: lines.map(l => ({
        productId: l.product_id,
        quantity: l.quantity,
        unitPrice: l.unit_price,
        condition: l.condition,
        lotNumber: l.lot_number,
      })),
    });
  }

  // Gather unsynced delivery logs
  const unsyncedLogs = await db.getAllAsync<any>(
    'SELECT * FROM delivery_logs WHERE synced = 0'
  );

  try {
    // Send to server
    const response = await api.sync({
      deviceId,
      lastSyncTimestamp,
      invoices: invoicePayloads,
      payments: paymentPayloads,
      credits: creditPayloads,
      deliveryLogs: unsyncedLogs.map(l => ({
        driverId: '', // Filled by server from auth
        locationId: l.location_id,
        action: l.action,
        metadata: l.metadata ? JSON.parse(l.metadata) : null,
        latitude: l.latitude,
        longitude: l.longitude,
        createdAt: l.created_at,
      })),
      truckInventoryUpdates: [],
    });

    // Mark synced records
    for (const result of response.results.invoices) {
      if (result.status === 'created' || result.status === 'duplicate') {
        await db.runAsync(
          'UPDATE invoices SET synced = 1, server_id = ? WHERE local_id = ?',
          [result.serverId, result.localId]
        );
      } else if (result.error) {
        errors.push(`Invoice ${result.localId}: ${result.error}`);
      }
    }

    for (const result of response.results.payments) {
      if (result.status === 'created') {
        await db.runAsync(
          'UPDATE payments SET synced = 1, server_id = ? WHERE local_id = ?',
          [result.serverId, result.localId]
        );
      }
    }

    for (const result of response.results.credits) {
      if (result.status === 'created') {
        await db.runAsync(
          'UPDATE credit_memos SET synced = 1, server_id = ? WHERE local_id = ?',
          [result.serverId, result.localId]
        );
      }
    }

    await db.runAsync('UPDATE delivery_logs SET synced = 1 WHERE synced = 0');

    // Apply server updates
    const { updates } = response;

    // Update products
    for (const product of updates.products || []) {
      await db.runAsync(`
        INSERT OR REPLACE INTO products (id, sku, upc, name, category_name, unit_of_measure, units_per_case, base_price, cost_price, taxable, perishable, lot_tracked, image_url, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [product.id, product.sku, product.upc ?? null, product.name, product.category?.name ?? null, product.unitOfMeasure ?? 'EACH', product.unitsPerCase ?? 1, product.basePrice, product.costPrice, product.taxable ? 1 : 0, product.perishable ? 1 : 0, product.lotTracked ? 1 : 0, product.imageUrl ?? null, product.updatedAt]);
    }

    // Update customers
    for (const customer of updates.customers || []) {
      await db.runAsync(`
        INSERT OR REPLACE INTO customers (id, name, contact_name, email, phone, account_number, chain_id, chain_name, chain_code, dex_supported, payment_terms, tax_exempt, credit_limit, notes, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [customer.id, customer.name, customer.contactName ?? null, customer.email ?? null, customer.phone ?? null, customer.accountNumber ?? null, customer.chainId ?? null, customer.chain?.name ?? null, customer.chain?.code ?? null, customer.chain?.dexSupported ? 1 : 0, customer.paymentTerms ?? 'NET30', customer.taxExempt ? 1 : 0, customer.creditLimit ?? null, customer.notes ?? null, customer.updatedAt]);

      // Update locations
      for (const loc of customer.locations || []) {
        await db.runAsync(`
          INSERT OR REPLACE INTO customer_locations (id, customer_id, name, address_line1, address_line2, city, state, zip, latitude, longitude, delivery_notes, receiving_hours_start, receiving_hours_end, dex_location_code)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [loc.id, customer.id, loc.name, loc.addressLine1, loc.addressLine2 ?? null, loc.city, loc.state, loc.zip, loc.latitude ?? null, loc.longitude ?? null, loc.deliveryNotes ?? null, loc.receivingHoursStart ?? null, loc.receivingHoursEnd ?? null, loc.dexLocationCode ?? null]);
      }
    }

    // Update promotions
    for (const promo of updates.promotions || []) {
      await db.runAsync(`
        INSERT OR REPLACE INTO promotions (id, name, type, chain_id, start_date, end_date, buy_quantity, get_quantity, discount_type, discount_value, min_order_amount, description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [promo.id, promo.name, promo.type, promo.chainId ?? null, promo.startDate, promo.endDate, promo.buyQuantity ?? null, promo.getQuantity ?? null, promo.discountType ?? null, promo.discountValue ?? null, promo.minOrderAmount ?? null, promo.description ?? null]);

      for (const item of promo.items || []) {
        await db.runAsync(`
          INSERT OR REPLACE INTO promotion_items (id, promotion_id, product_id, is_buy_item)
          VALUES (?, ?, ?, ?)
        `, [item.id, promo.id, item.productId, item.isBuyItem ? 1 : 0]);
      }
    }

    // Save sync timestamp
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
      ['last_sync', response.serverTimestamp]
    );

    return {
      uploaded: {
        invoices: invoicePayloads.length,
        payments: paymentPayloads.length,
        credits: creditPayloads.length,
      },
      downloaded: {
        products: updates.products?.length || 0,
        customers: updates.customers?.length || 0,
        routes: updates.routes?.length || 0,
      },
      errors,
    };
  } catch (err: any) {
    errors.push(`Sync failed: ${err.message}`);
    return {
      uploaded: { invoices: 0, payments: 0, credits: 0 },
      downloaded: { products: 0, customers: 0, routes: 0 },
      errors,
    };
  }
}

export async function getUnsyncedCounts(): Promise<{
  invoices: number;
  payments: number;
  credits: number;
  logs: number;
}> {
  const db = await getDatabase();
  const [inv, pmt, cr, logs] = await Promise.all([
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM invoices WHERE synced = 0'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM payments WHERE synced = 0'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM credit_memos WHERE synced = 0'),
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM delivery_logs WHERE synced = 0'),
  ]);

  return {
    invoices: inv?.count || 0,
    payments: pmt?.count || 0,
    credits: cr?.count || 0,
    logs: logs?.count || 0,
  };
}
