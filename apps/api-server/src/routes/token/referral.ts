import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";

const router = Router();

function requireWallet(req: Request, res: Response): string | null {
  const address = (req.session as any)?.tokenWallet;
  if (!address) { res.status(401).json({ error: "Connect your wallet first" }); return null; }
  return address;
}

/** Returns current ISO week label, e.g. "2026-W33" */
function currentWeekLabel(): string {
  const now  = new Date();
  const jan1 = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now.getTime() - jan1.getTime()) / 86400000) + jan1.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

// GET /api/token/referral — full referral dashboard data
router.get("/", async (req: Request, res: Response) => {
  const address = requireWallet(req, res);
  if (!address) return;

  try {
    // User record
    const { rows: [user] } = await pool.query(
      "SELECT referral_code, referred_by FROM ac_wallet_users WHERE address = $1", [address]
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    // Referral link base
    const base = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/agenticcore-token`
      : "https://agenticcore.io/token";
    const referralLink = `${base}?ref=${user.referral_code}`;

    // Direct referrals (wallets that used this user's referral code)
    const { rows: directReferrals } = await pool.query(`
      SELECT u.address, u.created_at,
        COALESCE(SUM(CASE WHEN c.status = 'confirmed' THEN c.usdt_amount ELSE 0 END), 0)::float AS usdt_spent
      FROM   ac_wallet_users u
      LEFT JOIN ac_presale_contributions c ON c.address = u.address
      WHERE  u.referred_by = $1
      GROUP  BY u.address, u.created_at
      ORDER  BY u.created_at DESC
    `, [user.referral_code]);

    // Direct USDT sales this wallet generated (referral purchases)
    const { rows: [directSales] } = await pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN date_trunc('week',created_at)=date_trunc('week',NOW()) THEN usdt_amount ELSE 0 END), 0)::float AS week_direct,
        COALESCE(SUM(usdt_amount), 0)::float AS total_direct
      FROM ac_presale_contributions
      WHERE status = 'confirmed' AND referrer_address = $1
    `, [address]);

    // Indirect sales (anyone referred by your direct referrals, unlimited depth — simplified 2-deep for now, expandable)
    const { rows: [indirectSales] } = await pool.query(`
      WITH depth1 AS (
        SELECT u.address
        FROM   ac_wallet_users u
        WHERE  u.referred_by = $1
      ),
      depth2 AS (
        SELECT u2.address
        FROM   ac_wallet_users u2
        JOIN   depth1 d1 ON u2.referred_by = (
          SELECT referral_code FROM ac_wallet_users WHERE address = d1.address
        )
      ),
      all_indirect AS (
        SELECT address FROM depth1
        UNION
        SELECT address FROM depth2
      )
      SELECT
        COALESCE(SUM(CASE WHEN date_trunc('week',c.created_at)=date_trunc('week',NOW()) THEN c.usdt_amount ELSE 0 END), 0)::float AS week_indirect,
        COALESCE(SUM(c.usdt_amount), 0)::float AS total_indirect
      FROM ac_presale_contributions c
      JOIN all_indirect ai ON c.address = ai.address
      WHERE c.status = 'confirmed'
    `, [user.referral_code]);

    const weekDirect   = parseFloat(directSales?.week_direct   || "0");
    const weekCombined = weekDirect + parseFloat(indirectSales?.week_indirect || "0");

    // Pool eligibility (permanent)
    const { rows: quals } = await pool.query(`
      SELECT pool_type, qualified_at, qualifying_week
      FROM   ac_pool_qualifications
      WHERE  address = $1
    `, [address]);
    const standardQual = quals.find(q => q.pool_type === "standard") || null;
    const vipQual      = quals.find(q => q.pool_type === "vip") || null;

    // Earnings history (USDT-based, most recent 50)
    const { rows: earnings } = await pool.query(`
      SELECT e.buyer_address, e.usdt_amount::float, e.created_at
      FROM   ac_referral_earnings e
      WHERE  e.referrer_address = $1
      ORDER  BY e.created_at DESC
      LIMIT  50
    `, [address]);

    // Total USDT earned from referrals
    const { rows: [totalEarnings] } = await pool.query(`
      SELECT COALESCE(SUM(usdt_amount), 0)::float AS total
      FROM   ac_referral_earnings
      WHERE  referrer_address = $1
    `, [address]);

    // Distribution history for this wallet
    const { rows: distHistory } = await pool.query(`
      SELECT dr.usdt_amount::float, d.pool_type, d.week_label, d.distributed_at
      FROM   ac_pool_distribution_recipients dr
      JOIN   ac_pool_distributions d ON d.id = dr.distribution_id
      WHERE  dr.address = $1
      ORDER  BY d.distributed_at DESC
      LIMIT  20
    `, [address]);

    res.json({
      referralCode: user.referral_code,
      referralLink,
      referredBy: user.referred_by,
      directReferrals,
      directReferralCount: directReferrals.length,
      directSalesUSDT:     parseFloat(directSales?.total_direct   || "0"),
      indirectSalesUSDT:   parseFloat(indirectSales?.total_indirect || "0"),
      weekDirectUSDT:      weekDirect,
      weekCombinedUSDT:    weekCombined,
      totalEarnedUSDT:     parseFloat(totalEarnings?.total || "0"),
      earnings,
      distHistory,
      poolStatus: {
        standard: {
          qualified:       !!standardQual,
          qualifiedAt:     standardQual?.qualified_at || null,
          qualifyingWeek:  standardQual?.qualifying_week || null,
          weekProgress:    weekDirect,
          threshold:       1000,
        },
        vip: {
          qualified:       !!vipQual,
          qualifiedAt:     vipQual?.qualified_at || null,
          qualifyingWeek:  vipQual?.qualifying_week || null,
          weekProgress:    weekCombined,
          threshold:       10000,
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/token/referral/leaderboard — top referrers by USDT earned
router.get("/leaderboard", async (_req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        referrer_address AS address,
        COUNT(*)::int                            AS referral_count,
        COALESCE(SUM(usdt_amount), 0)::float     AS total_usdt_earned,
        EXISTS(
          SELECT 1 FROM ac_pool_qualifications q
          WHERE q.address = ac_referral_earnings.referrer_address AND q.pool_type = 'standard'
        ) AS standard_qualified,
        EXISTS(
          SELECT 1 FROM ac_pool_qualifications q
          WHERE q.address = ac_referral_earnings.referrer_address AND q.pool_type = 'vip'
        ) AS vip_qualified
      FROM ac_referral_earnings
      GROUP BY referrer_address
      ORDER BY SUM(usdt_amount) DESC
      LIMIT 20
    `);
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
