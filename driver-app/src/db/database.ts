import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES_STATEMENTS } from './schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('olmos_dsd_driver.db');
  // expo-sqlite v15 (New Architecture) requires one statement per execAsync call
  for (const sql of CREATE_TABLES_STATEMENTS) {
    await db.execAsync(sql);
  }
  return db;
}

const RESET_TABLES = [
  'delivery_logs', 'credit_lines', 'credit_memos', 'payments',
  'invoice_lines', 'invoices', 'route_stops', 'routes', 'truck_inventory',
  'promotion_items', 'promotions', 'customer_prices', 'price_levels',
  'customer_locations', 'customers', 'products', 'customer_insights', 'sync_meta',
];

export async function resetDatabase(): Promise<void> {
  const database = await getDatabase();
  for (const table of RESET_TABLES) {
    await database.execAsync(`DELETE FROM ${table}`);
  }
}
