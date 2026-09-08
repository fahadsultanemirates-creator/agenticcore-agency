/**
 * AC Token Admin Routes — protected by AC_ADMIN_WALLET session check.
 * All routes require the authenticated session wallet to equal AC_ADMIN_WALLET.
 *
 * Routes:
 *   GET  /api/token/admin/wallet      — returns admin wallet address (public, for frontend detection)
 *   GET  /api/token/admin/stats       — overview stats
 *   GET  /api/token/admin/users       — searchable platform users
 *   GET  /api/token/admin/pool/:type  — pool details + eligible wallets
 *   POST /api/token/admin/pool/:type/distribute  — trigger distribution
 *   POST /api/token/admin/verify-tx   — confirm a pending TX
 *   POST /api/token/admin/inject-tokens — update presale token availability (manual record)
 */
import { Router, Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";

const router = Router();

/** Returns the admin wallet (lowercase) so the frontend can self-detect. */
function getAdminWallet(): string {
  return (process.env.AC_ADMIN_WALLET || "").toLowerCase().trim();
}

/** Middleware — only the admin wallet's session passes. */
function adminOnly(req: Request, res: Response, next: NextFunction) {
  const sessionWallet = ((req.session as any)?.tokenWallet || "").toLowerCase();
  const adminWallet   = getAdminWallet();

  if (!adminWallet) {
    return res.status(503).json({ error: "AC_ADMIN_WALLET is not configured on the server." });
  }
  if (!sessionWallet || sessionWallet !== adminWallet) {
    return res.status(403).json({ error: "Admin wallet required." });
  }
  next();
}

/** Returns current ISO week label, e.g. "2026-W33" */
function currentWeekLabel(): string {
  const now  = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// ── GET /api/token/admin/wallet ──────────────────────────────────────────
// Public — tells the frontend which wallet is the admin wallet so it can
// show/hide the admin panel without needing secrets.
router.get("/wallet", (_req: Request, res: Response) => {
  res.json({ adminWallet: getAdminWallet() || null });
});

// ── GET /api/token/admin/stats ───────────────────────────────────────────
router.get("/stats", adminOnly, async (_req: Request, res: Response) => {
  try {
    const week = currentWeekLabel();

    // Weekly raised (all confirmed, regardless of referral)
    const { rows: [weeklyRow] } = await pool.query(`
      SELECT COALESCE(SUM(usdt_amount), 0)::float AS raised
      FROM   ac_presale_contributions
      WHERE  status = 'confirmed'
        AND  date_trunc('week', created_at) = date_trunc('week', NOW())
    `);

    // All-time totals
    const { rows: [totals] } = await pool.query(`
      SELECT
        COALESCE(SUM(usdt_amount), 0)::float AS total_raised,
        COUNT(DISTINCT address)              AS total_wallets,
        COUNT(*)                             AS total_txs
      FROM ac_presale_contributions
      WHERE status = 'confirmed'
    `);

    // Pending pool balances (10% per referral-linked contribution, not yet distributed)
    const { rows: [pools] } = await pool.query(`
      SELECT
        COALESCE(SUM(usdt_amount) * 0.10, 0)::float AS standard_pool,
        COALESCE(SUM(usdt_amount) * 0.10, 0)::float AS vip_pool
      FROM ac_presale_contributions
      WHERE status = 'confirmed'
        AND has_referral = TRUE
        AND pool_distributed = FALSE
    `);

    // Qualified counts
    const { rows: qualCounts } = await pool.query(`
      SELECT pool_type, COUNT(*) AS cnt
      FROM ac_pool_qualifications
      GROUP BY pool_type
    `);
    const standardQual = qualCounts.find(r => r.pool_type === "standard")?.cnt || 0;
    const vipQual      = qualCounts.find(r => r.pool_type === "vip")?.cnt     || 0;

    // Pending contributions
    const { rows: [pending] } = await pool.query(`
      SELECT COUNT(*) AS cnt FROM ac_presale_contributions WHERE status = 'pending'
    `);

    // All registered wallets
    const { rows: [wallets] } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM ac_wallet_users`
    );

    res.json({
      weekRaisedUSDT:          parseFloat(weeklyRow?.raised || "0"),
      totalRaisedUSDT:         parseFloat(totals?.total_raised || "0"),
      totalWallets:            parseInt(wallets?.cnt || "0"),
      pendingTxs:              parseInt(pending?.cnt || "0"),
      standardPoolBalanceUSDT: parseFloat(pools?.standard_pool || "0"),
      vipPoolBalanceUSDT:      parseFloat(pools?.vip_pool      || "0"),
      standardQualifiedCount:  parseInt(String(standardQual)),
      vipQualifiedCount:       parseInt(String(vipQual)),
      currentWeek:             week,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/token/admin/users?search=&page= ─────────────────────────────
router.get("/users", adminOnly, async (req: Request, res: Response) => {
  try {
    const search = ((req.query.search as string) || "").toLowerCase().trim();
    const page   = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit  = 50;
    const offset = (page - 1) * limit;

    const whereClause = search ? `WHERE u.address ILIKE $1 OR u.referral_code ILIKE $1` : "";
    const params: any[] = search ? [`%${search}%`, limit, offset] : [limit, offset];

    const { rows } = await pool.query(`
      SELECT
        u.address,
        u.referral_code,
        u.referred_by,
        u.created_at,
        COALESCE(SUM(CASE WHEN c.status = 'confirmed' THEN c.usdt_amount ELSE 0 END), 0)::float AS total_usdt_spent,
        -- Direct referral sales this wallet generated
        COALESCE((
          SELECT SUM(c2.usdt_amount)
          FROM   ac_presale_contributions c2
          WHERE  c2.status = 'confirmed'
            AND  c2.referrer_address = u.address
        ), 0)::float AS direct_sales_usdt,
        EXISTS(SELECT 1 FROM ac_pool_qualifications q WHERE q.address = u.address AND q.pool_type = 'standard') AS standard_qualified,
        EXISTS(SELECT 1 FROM ac_pool_qualifications q WHERE q.address = u.address AND q.pool_type = 'vip')      AS vip_qualified
      FROM  ac_wallet_users u
      LEFT JOIN ac_presale_contributions c ON c.address = u.address
      ${whereClause}
      GROUP BY u.address, u.referral_code, u.referred_by, u.created_at
      ORDER BY u.created_at DESC
      LIMIT  ${search ? '$2' : '$1'} OFFSET ${search ? '$3' : '$2'}
    `, params);

    const { rows: [countRow] } = await pool.query(`
      SELECT COUNT(*) AS total FROM ac_wallet_users ${whereClause ? "WHERE address ILIKE $1 OR referral_code ILIKE $1" : ""}
    `, search ? [`%${search}%`] : []);

    res.json({
      users: rows,
      total: parseInt(countRow?.total || "0"),
      page,
      pages: Math.ceil(parseInt(countRow?.total || "0") / limit),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/token/admin/pool/:type ──────────────────────────────────────
router.get("/pool/:type", adminOnly, async (req: Request, res: Response) => {
  const type = req.params.type as "standard" | "vip";
  if (!["standard", "vip"].includes(type)) return res.status(400).json({ error: "Invalid pool type" });

  try {
    // Pool balance
    const { rows: [balRow] } = await pool.query(`
      SELECT COALESCE(SUM(usdt_amount) * 0.10, 0)::float AS balance
      FROM   ac_presale_contributions
      WHERE  status = 'confirmed' AND has_referral = TRUE AND pool_distributed = FALSE
    `);

    // Qualified wallets (permanent)
    const { rows: qualified } = await pool.query(`
      SELECT q.address, q.qualified_at, q.qualifying_week
      FROM   ac_pool_qualifications q
      WHERE  q.pool_type = $1
      ORDER  BY q.qualified_at ASC
    `, [type]);

    // This week's progress for new qualifiers (preview only)
    const threshold = type === "standard" ? 1000 : 10000;

    // Direct sales this week per wallet (for standard)
    // Combined sales this week per wallet (for VIP — use recursive CTE)
    let weeklyProgressRows: any[] = [];
    if (type === "standard") {
      const { rows } = await pool.query(`
        SELECT
          c.referrer_address AS address,
          SUM(c.usdt_amount)::float AS week_usdt
        FROM   ac_presale_contributions c
        WHERE  c.status = 'confirmed'
          AND  c.has_referral = TRUE
          AND  c.referrer_address IS NOT NULL
          AND  date_trunc('week', c.created_at) = date_trunc('week', NOW())
        GROUP  BY c.referrer_address
        HAVING SUM(c.usdt_amount) > 0
        ORDER  BY week_usdt DESC
        LIMIT  100
      `);
      weeklyProgressRows = rows;
    } else {
      // VIP: direct + indirect (simplified — full recursive would be expensive)
      const { rows } = await pool.query(`
        WITH direct AS (
          SELECT referrer_address AS address, SUM(usdt_amount) AS usdt
          FROM   ac_presale_contributions
          WHERE  status = 'confirmed' AND has_referral = TRUE AND referrer_address IS NOT NULL
            AND  date_trunc('week', created_at) = date_trunc('week', NOW())
          GROUP  BY referrer_address
        )
        SELECT address, usdt::float AS week_usdt
        FROM   direct
        ORDER  BY week_usdt DESC
        LIMIT  100
      `);
      weeklyProgressRows = rows;
    }

    // Past distributions
    const { rows: history } = await pool.query(`
      SELECT d.id, d.week_label, d.total_usdt::float, d.recipients_count, d.per_wallet_usdt::float, d.distributed_at
      FROM   ac_pool_distributions d
      WHERE  d.pool_type = $1
      ORDER  BY d.distributed_at DESC
      LIMIT  20
    `, [type]);

    res.json({
      type,
      balanceUSDT:      parseFloat(balRow?.balance || "0"),
      qualifiedWallets: qualified,
      qualifiedCount:   qualified.length,
      weeklyProgress:   weeklyProgressRows,
      threshold,
      history,
      newQualifiers:    weeklyProgressRows.filter(r => {
        const alreadyIn = qualified.find(q => q.address === r.address);
        return !alreadyIn && r.week_usdt >= threshold;
      }),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/token/admin/pool/:type/distribute ───────────────────────────
router.post("/pool/:type/distribute", adminOnly, async (req: Request, res: Response) => {
  const type = req.params.type as "standard" | "vip";
  if (!["standard", "vip"].includes(type)) return res.status(400).json({ error: "Invalid pool type" });

  try {
    // 1. Get pending pool balance
    const { rows: [balRow] } = await pool.query(`
      SELECT
        COALESCE(SUM(usdt_amount) * 0.10, 0)::float AS balance,
        ARRAY_AGG(id)                                AS contribution_ids
      FROM ac_presale_contributions
      WHERE status = 'confirmed' AND has_referral = TRUE AND pool_distributed = FALSE
    `);
    const balance       = parseFloat(balRow?.balance || "0");
    const contribIds    = balRow?.contribution_ids || [];

    if (balance < 0.01) {
      return res.status(400).json({ error: "Pool balance is too low to distribute." });
    }

    // 2. Get all permanently qualified wallets for this pool type
    const { rows: qualified } = await pool.query(`
      SELECT address FROM ac_pool_qualifications WHERE pool_type = $1
    `, [type]);

    if (qualified.length === 0) {
      return res.status(400).json({ error: "No qualified wallets for this pool." });
    }

    const perWallet   = balance / qualified.length;
    const weekLabel   = currentWeekLabel();

    // 3. Record distribution
    const { rows: [dist] } = await pool.query(`
      INSERT INTO ac_pool_distributions (pool_type, week_label, total_usdt, recipients_count, per_wallet_usdt)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [type, weekLabel, balance.toFixed(6), qualified.length, perWallet.toFixed(6)]);

    // 4. Record per-recipient rows
    for (const q of qualified) {
      await pool.query(`
        INSERT INTO ac_pool_distribution_recipients (distribution_id, address, usdt_amount)
        VALUES ($1, $2, $3)
      `, [dist.id, q.address, perWallet.toFixed(6)]);
    }

    // 5. Mark contributions as distributed
    if (contribIds.length > 0) {
      await pool.query(
        `UPDATE ac_presale_contributions SET pool_distributed = TRUE WHERE id = ANY($1)`,
        [contribIds]
      );
    }

    res.json({
      ok: true,
      distributionId:  dist.id,
      poolType:        type,
      totalUSDT:       balance,
      recipientsCount: qualified.length,
      perWalletUSDT:   perWallet,
      weekLabel,
      recipients:      qualified.map(q => q.address),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/token/admin/verify-tx ──────────────────────────────────────
router.post("/verify-tx", adminOnly, async (req: Request, res: Response) => {
  const { txHash } = req.body;
  if (!txHash) return res.status(400).json({ error: "txHash required" });

  try {
    // Fetch contribution row
    const { rows: [contrib] } = await pool.query(
      `SELECT id, address, usdt_amount, status FROM ac_presale_contributions WHERE tx_hash = $1`,
      [txHash.toLowerCase()]
    );
    if (!contrib) return res.status(404).json({ error: "TX not found" });
    if (contrib.status === "confirmed") return res.json({ ok: true, alreadyConfirmed: true });

    // Verify with BSCScan
    const apiKey = process.env.BSCSCAN_API_KEY;
    const bscResp = await fetch(
      `https://api.bscscan.com/api?module=transaction&action=gettxreceiptstatus&txhash=${txHash}&apikey=${apiKey}`
    );
    const bscData = await bscResp.json() as any;
    const confirmed = bscData?.result?.status === "1";

    if (!confirmed) {
      return res.json({ ok: false, confirmed: false, bscscanResult: bscData?.result });
    }

    // Get the buyer's referrer info
    const { rows: [buyer] } = await pool.query(
      `SELECT address, referred_by FROM ac_wallet_users WHERE address = $1`,
      [contrib.address]
    );

    let referrerAddress: string | null = null;
    let hasReferral = false;

    if (buyer?.referred_by) {
      // Resolve the referral_code → referrer address
      const { rows: [referrer] } = await pool.query(
        `SELECT address FROM ac_wallet_users WHERE referral_code = $1`,
        [buyer.referred_by]
      );
      if (referrer) {
        referrerAddress = referrer.address;
        hasReferral     = true;
      }
    }

    const usdtAmt = parseFloat(contrib.usdt_amount);

    // Update contribution: confirmed + referral metadata
    await pool.query(`
      UPDATE ac_presale_contributions
      SET status = 'confirmed', has_referral = $1, referrer_address = $2
      WHERE id = $3
    `, [hasReferral, referrerAddress, contrib.id]);

    // Record referral earnings (USDT-based)
    if (hasReferral && referrerAddress) {
      const referralUSDT  = usdtAmt * 0.20; // 20% to referrer
      const baseAC        = usdtAmt * 10_000_000;
      await pool.query(`
        INSERT INTO ac_referral_earnings (referrer_address, buyer_address, token_amount, usdt_amount)
        VALUES ($1, $2, $3, $4)
      `, [referrerAddress, contrib.address, Math.round(baseAC * 0.20).toFixed(0), referralUSDT.toFixed(6)]);

      // Check pool qualification (permanent — check once, qualify forever)
      const weekLabel = currentWeekLabel();
      for (const poolType of ["standard", "vip"] as const) {
        const threshold = poolType === "standard" ? 1000 : 10000;

        // Calculate total direct sales for this referrer this week
        const { rows: [weekSales] } = await pool.query(`
          SELECT COALESCE(SUM(usdt_amount), 0)::float AS total
          FROM   ac_presale_contributions
          WHERE  status = 'confirmed'
            AND  referrer_address = $1
            AND  date_trunc('week', created_at) = date_trunc('week', NOW())
        `, [referrerAddress]);

        if (parseFloat(weekSales?.total || "0") >= threshold) {
          // Permanently qualify — UPSERT (do nothing if already qualified)
          await pool.query(`
            INSERT INTO ac_pool_qualifications (address, pool_type, qualifying_week)
            VALUES ($1, $2, $3)
            ON CONFLICT (address, pool_type) DO NOTHING
          `, [referrerAddress, poolType, weekLabel]);
        }
      }
    }

    res.json({ ok: true, confirmed: true, hasReferral, referrerAddress, usdtAmt });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/token/admin/pending-txs ────────────────────────────────────
router.get("/pending-txs", adminOnly, async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT pc.id, pc.address, pc.tx_hash, pc.usdt_amount::float, pc.status, pc.created_at,
             u.referral_code, u.referred_by
      FROM   ac_presale_contributions pc
      LEFT JOIN ac_wallet_users u ON u.address = pc.address
      WHERE  pc.status = 'pending'
      ORDER  BY pc.created_at DESC
      LIMIT  100
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
