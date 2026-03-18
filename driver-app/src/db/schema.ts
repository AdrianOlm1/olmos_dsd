/**
 * SQLite schema for offline-first driver app.
 * This is a denormalized subset of the server DB optimized for local operations.
 */

export const CREATE_TABLES_SQL = `
-- Sync metadata
CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Products catalog (synced from server)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  sku TEXT NOT NULL,
  upc TEXT,
  name TEXT NOT NULL,
  category_name TEXT,
  unit_of_measure TEXT DEFAULT 'EACH',
  units_per_case INTEGER DEFAULT 1,
  base_price REAL NOT NULL,
  cost_price REAL NOT NULL,
  taxable INTEGER DEFAULT 1,
  perishable INTEGER DEFAULT 0,
  lot_tracked INTEGER DEFAULT 0,
  image_url TEXT,
  updated_at TEXT NOT NULL
);

-- Customer data (synced from server)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  account_number TEXT,
  chain_id TEXT,
  chain_name TEXT,
  chain_code TEXT,
  dex_supported INTEGER DEFAULT 0,
  payment_terms TEXT DEFAULT 'NET30',
  tax_exempt INTEGER DEFAULT 0,
  credit_limit REAL,
  notes TEXT,
  updated_at TEXT NOT NULL
);

-- Customer locations (synced from server)
CREATE TABLE IF NOT EXISTS customer_locations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  name TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  delivery_notes TEXT,
  receiving_hours_start TEXT,
  receiving_hours_end TEXT,
  dex_location_code TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Price levels (synced from server)
CREATE TABLE IF NOT EXISTS price_levels (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  level_code TEXT NOT NULL,
  price REAL NOT NULL,
  min_quantity INTEGER DEFAULT 1,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Customer-specific prices (synced from server)
CREATE TABLE IF NOT EXISTS customer_prices (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  price REAL NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Promotions (synced from server)
CREATE TABLE IF NOT EXISTS promotions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  chain_id TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  buy_quantity INTEGER,
  get_quantity INTEGER,
  discount_type TEXT,
  discount_value REAL,
  min_order_amount REAL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS promotion_items (
  id TEXT PRIMARY KEY,
  promotion_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  is_buy_item INTEGER DEFAULT 1,
  FOREIGN KEY (promotion_id) REFERENCES promotions(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Truck inventory (loaded daily, updated as sales/returns happen)
CREATE TABLE IF NOT EXISTS truck_inventory (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  quantity_loaded REAL NOT NULL,
  quantity_current REAL NOT NULL,
  quantity_sold REAL DEFAULT 0,
  quantity_returned REAL DEFAULT 0,
  lot_number TEXT,
  expiration_date TEXT,
  route_date TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Route and stops (synced from server)
CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  route_date TEXT NOT NULL,
  status TEXT DEFAULT 'PLANNED',
  started_at TEXT,
  completed_at TEXT,
  total_stops INTEGER DEFAULT 0,
  completed_stops INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS route_stops (
  id TEXT PRIMARY KEY,
  route_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  address TEXT NOT NULL,
  stop_order INTEGER NOT NULL,
  status TEXT DEFAULT 'PENDING',
  planned_arrival TEXT,
  actual_arrival TEXT,
  departed_at TEXT,
  no_service_reason TEXT,
  notes TEXT,
  FOREIGN KEY (route_id) REFERENCES routes(id),
  FOREIGN KEY (location_id) REFERENCES customer_locations(id)
);

-- Locally created invoices (queued for sync)
CREATE TABLE IF NOT EXISTS invoices (
  local_id TEXT PRIMARY KEY,
  server_id TEXT,
  invoice_number TEXT,
  customer_id TEXT NOT NULL,
  location_id TEXT,
  route_id TEXT,
  status TEXT DEFAULT 'COMPLETED',
  subtotal REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  amount_paid REAL DEFAULT 0,
  balance_due REAL NOT NULL,
  notes TEXT,
  signature_data TEXT,
  signed_by_name TEXT,
  delivered_at TEXT,
  dex_transmitted INTEGER DEFAULT 0,
  synced INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  local_id TEXT PRIMARY KEY,
  invoice_local_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  discount REAL DEFAULT 0,
  line_total REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  lot_number TEXT,
  expiration_date TEXT,
  refused INTEGER DEFAULT 0,
  refused_reason TEXT,
  promotion_id TEXT,
  FOREIGN KEY (invoice_local_id) REFERENCES invoices(local_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Locally collected payments (queued for sync)
CREATE TABLE IF NOT EXISTS payments (
  local_id TEXT PRIMARY KEY,
  server_id TEXT,
  invoice_local_id TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,
  check_number TEXT,
  reference TEXT,
  collected_at TEXT NOT NULL,
  synced INTEGER DEFAULT 0,
  FOREIGN KEY (invoice_local_id) REFERENCES invoices(local_id)
);

-- Locally created credits (queued for sync)
CREATE TABLE IF NOT EXISTS credit_memos (
  local_id TEXT PRIMARY KEY,
  server_id TEXT,
  credit_number TEXT,
  customer_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  total_amount REAL NOT NULL,
  notes TEXT,
  signature_data TEXT,
  synced INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS credit_lines (
  local_id TEXT PRIMARY KEY,
  credit_local_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  line_total REAL NOT NULL,
  condition TEXT DEFAULT 'RESALABLE',
  lot_number TEXT,
  FOREIGN KEY (credit_local_id) REFERENCES credit_memos(local_id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Delivery event log (GPS, timestamps, actions)
CREATE TABLE IF NOT EXISTS delivery_logs (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL,
  action TEXT NOT NULL,
  metadata TEXT,
  latitude REAL,
  longitude REAL,
  synced INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Customer insights cache
CREATE TABLE IF NOT EXISTS customer_insights (
  customer_id TEXT PRIMARY KEY,
  avg_order_value REAL,
  top_products TEXT,
  suggested_products TEXT,
  churn_risk REAL,
  last_order_date TEXT,
  order_count INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_upc ON products(upc);
CREATE INDEX IF NOT EXISTS idx_customer_locations_customer ON customer_locations(customer_id);
CREATE INDEX IF NOT EXISTS idx_truck_inv_date ON truck_inventory(route_date);
CREATE INDEX IF NOT EXISTS idx_invoices_synced ON invoices(synced);
CREATE INDEX IF NOT EXISTS idx_payments_synced ON payments(synced);
CREATE INDEX IF NOT EXISTS idx_credits_synced ON credit_memos(synced);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_synced ON delivery_logs(synced);
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON route_stops(route_id);
`;

/**
 * expo-sqlite v15 (New Architecture / JSI) does not support multiple statements
 * in a single execAsync call. Split on semicolons and run each statement individually.
 */
export const CREATE_TABLES_STATEMENTS: string[] = CREATE_TABLES_SQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));
