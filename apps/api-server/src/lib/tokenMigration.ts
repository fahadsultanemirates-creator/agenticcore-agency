/**
 * Token system DB migrations — run on server startup.
 * All statements are idempotent (IF NOT EXISTS / IF NOT COLUMN).
 */
import { pool } from "@workspace/db";

export async function runTokenMigrations() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Core tables (may already exist) ───────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ac_wallet_users (
        address       TEXT PRIMARY KEY,
        referral_code TEXT UNIQUE NOT NULL,
        referred_by   TEXT,
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        last_seen     TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ac_presale_contributions (
        id            SERIAL PRIMARY KEY,
        address       TEXT NOT NULL,
        tx_hash       TEXT UNIQUE NOT NULL,
        usdt_amount   NUMERIC(18,6) NOT NULL,
        token_amount  NUMERIC(30,0) NOT NULL DEFAULT 0,
        bonus_amount  NUMERIC(30,0) NOT NULL DEFAULT 0,
        status        TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending','confirmed','failed')),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ac_referral_earnings (
        id               SERIAL PRIMARY KEY,
        referrer_address TEXT NOT NULL,
        buyer_address    TEXT NOT NULL,
        token_amount     NUMERIC(30,0) NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Migration: add new columns to existing tables ─────────────────────
    const addCols = [
      `ALTER TABLE ac_presale_contributions ADD COLUMN IF NOT EXISTS has_referral    BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE ac_presale_contributions ADD COLUMN IF NOT EXISTS referrer_address TEXT`,
      `ALTER TABLE ac_presale_contributions ADD COLUMN IF NOT EXISTS pool_distributed BOOLEAN DEFAULT FALSE`,
      `ALTER TABLE ac_referral_earnings     ADD COLUMN IF NOT EXISTS usdt_amount NUMERIC(18,6) DEFAULT 0`,
    ];
    for (const sql of addCols) await client.query(sql);

    // ── New tables ────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS ac_pool_qualifications (
        address        TEXT NOT NULL,
        pool_type      TEXT NOT NULL CHECK (pool_type IN ('standard','vip')),
        qualified_at   TIMESTAMPTZ DEFAULT NOW(),
        qualifying_week TEXT NOT NULL,
        PRIMARY KEY (address, pool_type)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ac_pool_distributions (
        id               SERIAL PRIMARY KEY,
        pool_type        TEXT NOT NULL,
        week_label       TEXT NOT NULL,
        total_usdt       NUMERIC(18,6) NOT NULL DEFAULT 0,
        recipients_count INT           NOT NULL DEFAULT 0,
        per_wallet_usdt  NUMERIC(18,6) NOT NULL DEFAULT 0,
        distributed_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS ac_pool_distribution_recipients (
        id              SERIAL PRIMARY KEY,
        distribution_id INT REFERENCES ac_pool_distributions(id),
        address         TEXT NOT NULL,
        usdt_amount     NUMERIC(18,6) NOT NULL,
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // ── Indexes ───────────────────────────────────────────────────────────
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_ac_presale_address   ON ac_presale_contributions(address)`,
      `CREATE INDEX IF NOT EXISTS idx_ac_presale_referrer  ON ac_presale_contributions(referrer_address)`,
      `CREATE INDEX IF NOT EXISTS idx_ac_presale_status    ON ac_presale_contributions(status)`,
      `CREATE INDEX IF NOT EXISTS idx_ac_referral_earnings ON ac_referral_earnings(referrer_address)`,
      `CREATE INDEX IF NOT EXISTS idx_ac_pool_qual_type    ON ac_pool_qualifications(pool_type)`,
    ];
    for (const sql of indexes) await client.query(sql);

    await client.query("COMMIT");
    console.log("[TokenMigration] All AC token tables migrated successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[TokenMigration] Migration failed:", err);
    throw err;
  } finally {
    client.release();
  }
}
