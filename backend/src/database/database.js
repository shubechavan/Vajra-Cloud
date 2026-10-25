// ═══════════════════════════════════════════════════════════════
// Vajra Cloud — SQLite Database Module (sql.js)
//
// sql.js is a pure JavaScript SQLite compiled to WebAssembly.
// It works on Windows without Visual Studio / C++ build tools.
//
// The database is loaded from disk on startup, and we persist
// changes back to disk after every write operation.
// ═══════════════════════════════════════════════════════════════

import initSqlJs from 'sql.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database file lives in backend/data/
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'vajra-cloud.db');

// Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Initialise sql.js and the database ──

let db = null;

/**
 * Persist the current in-memory database to disk.
 * Called after every write (INSERT / UPDATE / DELETE).
 */
function saveToDisk() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

/**
 * Initialise the database. Must be called (and awaited) before
 * any route handler runs.
 */
export async function initDatabase() {
  const SQL = await initSqlJs();

  // Load existing DB file or create a new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log(`[DB] Loaded existing database from ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log(`[DB] Created new database at ${DB_PATH}`);
  }

  // ── Create tables if they don't exist ──
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      id                  INTEGER PRIMARY KEY CHECK (id = 1),
      min_instances       INTEGER NOT NULL DEFAULT 2,
      max_instances       INTEGER NOT NULL DEFAULT 6,
      scale_out_threshold INTEGER NOT NULL DEFAULT 70,
      scale_in_threshold  INTEGER NOT NULL DEFAULT 30,
      updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type  TEXT NOT NULL,
      message     TEXT NOT NULL,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // ── Insert default settings row if none exists ──
  const rows = db.exec('SELECT id FROM settings WHERE id = 1');
  if (rows.length === 0 || rows[0].values.length === 0) {
    db.run(`
      INSERT INTO settings (id, min_instances, max_instances, scale_out_threshold, scale_in_threshold)
      VALUES (1, 2, 6, 70, 30)
    `);
  }

  saveToDisk();
  console.log('[DB] Tables verified and ready');
}

// ── Helper wrappers that match the better-sqlite3 style API ──

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE).
 * Automatically persists to disk after execution.
 * @param {string} sql - SQL statement with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {{ lastInsertRowid: number }}
 */
export function run(sql, params = []) {
  db.run(sql, params);
  saveToDisk();

  // Get last insert rowid
  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastId = result.length > 0 ? result[0].values[0][0] : 0;
  return { lastInsertRowid: lastId };
}

/**
 * Execute a SELECT and return all rows as an array of objects.
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Array<Object>}
 */
export function all(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Execute a SELECT and return the first row as an object, or null.
 * @param {string} sql - SQL query with ? placeholders
 * @param {Array} params - Parameter values
 * @returns {Object|null}
 */
export function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export default { run, all, get, initDatabase };
