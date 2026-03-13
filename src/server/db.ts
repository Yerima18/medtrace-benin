import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? path.join(__dirname, '../../medtrace.db');

const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Migrations ──────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    name   TEXT NOT NULL UNIQUE,
    run_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

const migrations: Record<string, string> = {
  '001_initial_schema': `
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      email      TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL CHECK(role IN ('admin', 'distributor', 'pharmacy', 'patient')),
      name       TEXT NOT NULL,
      is_active  INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS pharmacies (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id        INTEGER NOT NULL UNIQUE,
      name           TEXT NOT NULL,
      location       TEXT NOT NULL,
      license_number TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS medicines (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      description  TEXT,
      dosage       TEXT,
      created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id     INTEGER NOT NULL,
      distributor_id  INTEGER NOT NULL,
      batch_number    TEXT NOT NULL UNIQUE,
      expiration_date DATE NOT NULL,
      quantity        INTEGER NOT NULL,
      created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id)    REFERENCES medicines(id),
      FOREIGN KEY (distributor_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS qr_codes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id    INTEGER NOT NULL,
      unique_code TEXT NOT NULL UNIQUE,
      status      TEXT NOT NULL DEFAULT 'generated'
                  CHECK(status IN ('generated', 'shipped', 'received', 'dispensed')),
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );

    CREATE TABLE IF NOT EXISTS scan_logs (
      id                 INTEGER PRIMARY KEY AUTOINCREMENT,
      qr_code_id         INTEGER,
      scanned_by_role    TEXT NOT NULL,
      scanned_by_user_id INTEGER,
      location           TEXT,
      scan_time          DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_suspicious      INTEGER DEFAULT 0,
      FOREIGN KEY (qr_code_id)         REFERENCES qr_codes(id),
      FOREIGN KEY (scanned_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      qr_code_id  INTEGER,
      message     TEXT NOT NULL,
      is_resolved INTEGER NOT NULL DEFAULT 0,
      created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (qr_code_id) REFERENCES qr_codes(id)
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id    INTEGER NOT NULL,
      token      TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      used       INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_qr_codes_unique_code ON qr_codes(unique_code);
    CREATE INDEX IF NOT EXISTS idx_scan_logs_qr_code_id ON scan_logs(qr_code_id);
    CREATE INDEX IF NOT EXISTS idx_batches_distributor   ON batches(distributor_id);
  `,

  '002_shipment_tracking': `
    CREATE TABLE IF NOT EXISTS shipments (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id      INTEGER NOT NULL,
      from_user_id  INTEGER NOT NULL,
      to_user_id    INTEGER NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'in_transit', 'delivered', 'rejected')),
      notes         TEXT,
      shipped_at    DATETIME,
      delivered_at  DATETIME,
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id)     REFERENCES batches(id),
      FOREIGN KEY (from_user_id) REFERENCES users(id),
      FOREIGN KEY (to_user_id)   REFERENCES users(id)
    );
  `,
};

const runMigration = db.transaction((name: string, sql: string) => {
  const already = db.prepare('SELECT id FROM _migrations WHERE name = ?').get(name);
  if (!already) {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(name);
    console.log(`[DB] Migration applied: ${name}`);
  }
});

for (const [name, sql] of Object.entries(migrations)) {
  runMigration(name, sql);
}

// ─── Seed admin ──────────────────────────────────────────────────────────────

const adminEmail = process.env.ADMIN_EMAIL || 'admin@medtrace.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@MedTrace2024!';

const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!existingAdmin) {
  const hashed = bcrypt.hashSync(adminPassword, 12);
  db.prepare('INSERT INTO users (email, password, role, name) VALUES (?, ?, ?, ?)').run(
    adminEmail, hashed, 'admin', 'System Admin'
  );
  console.log(`[DB] Admin seeded: ${adminEmail}`);
}

export default db;
