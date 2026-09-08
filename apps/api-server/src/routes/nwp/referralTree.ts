import { Router } from "express";
import { db } from "@workspace/db";
import {
  nwpUsersTable,
  nwpRewardLedgerTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireNwpAuth } from "../../middlewares/nwpAuthMiddleware";
import { REFERRAL_RATES } from "../../lib/financialEngine";

const router = Router();
router.use(requireNwpAuth);

// ── GET /nwp/referral-tree ────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const tree: Array<{
      level: number;
      members: Array<{
        id: number;
        fullName: string;
        package: string | null;
        status: string;
        investmentAmountUsd: string | null;
        joinedAt: Date;
        rewardRate: number;
        totalRewardsFromThemUsd: string;
      }>;
    }> = [];

    let currentLevelIds = [userId];
    let totalMembers = 0;
    let totalRewardsUsd = 0;

    for (let level = 1; level <= 10; level++) {
      if (currentLevelIds.length === 0) break;

      // Find all users referred by anyone in the current level
      const members = await db
        .select({
          id: nwpUsersTable.id,
          fullName: nwpUsersTable.fullName,
          package: nwpUsersTable.package,
          status: nwpUsersTable.status,
          investmentAmountUsd: nwpUsersTable.investmentAmountUsd,
          createdAt: nwpUsersTable.createdAt,
        })
        .from(nwpUsersTable)
        .where(
          currentLevelIds.length === 1
            ? eq(nwpUsersTable.referredById, currentLevelIds[0])
            : sql`${nwpUsersTable.referredById} = ANY(${sql.raw("ARRAY[" + currentLevelIds.join(",") + "]::integer[]")})`,
        );

      if (members.length === 0) break;

      const rewardRate = REFERRAL_RATES[level] ?? 0;

      const memberDetails = await Promise.all(
        members.map(async (m) => {
          // Total rewards this member generated for the viewer
          const [rewardRow] = await db
            .select({ total: sql<string>`COALESCE(SUM(CAST(${nwpRewardLedgerTable.amountUsd} AS NUMERIC)), 0)` })
            .from(nwpRewardLedgerTable)
            .where(and(eq(nwpRewardLedgerTable.userId, userId), eq(nwpRewardLedgerTable.sourceUserId, m.id)));

          const total = Number(rewardRow?.total ?? 0);
          totalRewardsUsd += total;

          return {
            id: m.id,
            fullName: m.fullName,
            package: m.package,
            status: m.status,
            investmentAmountUsd: m.investmentAmountUsd,
            joinedAt: m.createdAt,
            rewardRate,
            totalRewardsFromThemUsd: total.toFixed(2),
          };
        }),
      );

      tree.push({ level, members: memberDetails });
      totalMembers += members.length;
      currentLevelIds = members.map((m) => m.id);
    }

    res.json({
      tree,
      summary: {
        totalMembers,
        totalRewardsUsd: totalRewardsUsd.toFixed(2),
        levelsActive: tree.length,
        referralRates: REFERRAL_RATES,
      },
    });
  } catch (err) {
    console.error("[NWP referral tree]", err);
    res.status(500).json({ error: "Failed to load referral tree" });
  }
});

// ── GET /nwp/referral-tree/stats ──────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const [user] = await db
      .select({ referralCode: nwpUsersTable.referralCode })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const [directCount] = await db
      .select({ count: sql<string>`COUNT(*)` })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.referredById, userId));

    const [totalRewardRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(${nwpRewardLedgerTable.amountUsd} AS NUMERIC)), 0)` })
      .from(nwpRewardLedgerTable)
      .where(eq(nwpRewardLedgerTable.userId, userId));

    const [upfrontRow] = await db
      .select({ total: sql<string>`COALESCE(SUM(CAST(${nwpRewardLedgerTable.amountUsd} AS NUMERIC)), 0)` })
      .from(nwpRewardLedgerTable)
      .where(and(eq(nwpRewardLedgerTable.userId, userId), eq(nwpRewardLedgerTable.rewardType, "upfront")));

    res.json({
      referralCode: user.referralCode,
      referralLink: `https://nexuswealthpartners.group/nexus-wealth-partners/ref/${user.referralCode}`,
      directReferrals: Number(directCount?.count ?? 0),
      totalRewardsUsd: Number(totalRewardRow?.total ?? 0).toFixed(2),
      upfrontBonusesUsd: Number(upfrontRow?.total ?? 0).toFixed(2),
      referralRates: REFERRAL_RATES,
    });
  } catch (err) {
    console.error("[NWP referral stats]", err);
    res.status(500).json({ error: "Failed to fetch referral stats" });
  }
});

export default router;
