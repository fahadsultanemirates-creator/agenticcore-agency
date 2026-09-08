import { db } from "@workspace/db";
import {
  nwpUsersTable,
  nwpProfitLedgerTable,
  nwpRewardLedgerTable,
} from "@workspace/db/schema";
import { eq, and, sql } from "drizzle-orm";

// ── Package rates (monthly %) ──────────────────────────────────────────────────
export const PACKAGE_RATES: Record<string, number> = {
  silver: 0.20,
  gold: 0.22,
  platinum: 0.24,
  emerald: 0.26,
  vip: 0.28,
};

export const PACKAGE_RANGES: Record<string, [number, number]> = {
  silver:   [100,    1000],
  gold:     [1001,   5000],
  platinum: [5001,   10000],
  emerald:  [10001,  20000],
  vip:      [20001,  Infinity],
};

// Referral rewards per level (fraction of referred member's daily profit)
export const REFERRAL_RATES: Record<number, number> = {
  1: 0.20, 2: 0.18, 3: 0.16, 4: 0.14, 5: 0.12,
  6: 0.10, 7: 0.08, 8: 0.06, 9: 0.04, 10: 0.02,
};

// Upfront bonus: direct referrer gets this % of the referred member's investment
export const UPFRONT_BONUS_RATE = 0.10;

// ── Working day logic ─────────────────────────────────────────────────────────
export function isWorkingDay(date: Date): boolean {
  const dow = date.getUTCDay(); // 0=Sun, 6=Sat
  return dow >= 1 && dow <= 5;
}

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10); // "YYYY-MM-DD"
}

// ── Daily profit calculation ──────────────────────────────────────────────────
export function calculateDailyProfit(
  investmentAmountUsd: string | number,
  packageName: string,
): number {
  const amount = typeof investmentAmountUsd === "string"
    ? parseFloat(investmentAmountUsd)
    : investmentAmountUsd;
  const rate = PACKAGE_RATES[packageName] ?? 0;
  return (amount * rate) / 20; // 20 working days per month
}

// ── Credit daily profits for all active users ────────────────────────────────
export async function creditDailyProfits(targetDate?: Date): Promise<void> {
  const date = targetDate ?? new Date();

  if (!isWorkingDay(date)) {
    console.info("[NWP Engine] Skipping daily profits — not a working day:", toDateString(date));
    return;
  }

  const dateStr = toDateString(date);
  console.info("[NWP Engine] Running daily profit credit for:", dateStr);

  // Fetch all active users with investment data
  const activeUsers = await db
    .select({
      id: nwpUsersTable.id,
      package: nwpUsersTable.package,
      investmentAmountUsd: nwpUsersTable.investmentAmountUsd,
      referredById: nwpUsersTable.referredById,
    })
    .from(nwpUsersTable)
    .where(
      and(
        eq(nwpUsersTable.status, "active"),
        sql`${nwpUsersTable.package} IS NOT NULL`,
        sql`${nwpUsersTable.investmentAmountUsd} IS NOT NULL`,
      ),
    );

  console.info(`[NWP Engine] Processing ${activeUsers.length} active users`);

  for (const user of activeUsers) {
    if (!user.package || !user.investmentAmountUsd) continue;

    const dailyProfit = calculateDailyProfit(user.investmentAmountUsd, user.package);
    const profitStr = dailyProfit.toFixed(2);

    try {
      // Credit profit (unique constraint prevents double-crediting)
      await db
        .insert(nwpProfitLedgerTable)
        .values({
          userId: user.id,
          creditDate: dateStr,
          amountUsd: profitStr,
          isWithdrawn: false,
        })
        .onConflictDoNothing();

      // Credit referral rewards up the chain
      await creditReferralRewards(user.id, dailyProfit, dateStr);
    } catch (err) {
      console.error(`[NWP Engine] Error crediting profit for user ${user.id}:`, err);
    }
  }

  console.info("[NWP Engine] Daily profit credit complete");
}

// ── Credit referral rewards (up to 10 levels) ────────────────────────────────
export async function creditReferralRewards(
  sourceUserId: number,
  sourceDailyProfit: number,
  dateStr: string,
): Promise<void> {
  let currentUserId = sourceUserId;

  for (let level = 1; level <= 10; level++) {
    // Find who referred the current user
    const [current] = await db
      .select({ referredById: nwpUsersTable.referredById })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, currentUserId))
      .limit(1);

    if (!current?.referredById) break; // No more referrers up the chain

    const referrerId = current.referredById;
    const rewardRate = REFERRAL_RATES[level] ?? 0;
    const rewardAmount = (sourceDailyProfit * rewardRate).toFixed(2);

    await db
      .insert(nwpRewardLedgerTable)
      .values({
        userId: referrerId,
        sourceUserId,
        level,
        rewardType: "daily",
        amountUsd: rewardAmount,
        creditDate: dateStr,
        isWithdrawn: false,
      });

    currentUserId = referrerId;
  }
}

// ── Credit upfront referral bonus ─────────────────────────────────────────────
export async function creditUpfrontBonus(
  activatedUserId: number,
  investmentAmountUsd: string | number,
): Promise<void> {
  const [user] = await db
    .select({ referredById: nwpUsersTable.referredById })
    .from(nwpUsersTable)
    .where(eq(nwpUsersTable.id, activatedUserId))
    .limit(1);

  if (!user?.referredById) return; // Company link — no upfront bonus

  const amount = typeof investmentAmountUsd === "string"
    ? parseFloat(investmentAmountUsd)
    : investmentAmountUsd;

  const bonusAmount = (amount * UPFRONT_BONUS_RATE).toFixed(2);

  await db.insert(nwpRewardLedgerTable).values({
    userId: user.referredById,
    sourceUserId: activatedUserId,
    level: 1,
    rewardType: "upfront",
    amountUsd: bonusAmount,
    creditDate: toDateString(new Date()),
    isWithdrawn: false,
  });
}

// ── Credit VIP variable bonus (month-end) ─────────────────────────────────────
export async function creditVipBonuses(targetDate?: Date): Promise<void> {
  const date = targetDate ?? new Date();
  const dateStr = toDateString(date);

  const vipUsers = await db
    .select({
      id: nwpUsersTable.id,
      email: nwpUsersTable.email,
      fullName: nwpUsersTable.fullName,
      investmentAmountUsd: nwpUsersTable.investmentAmountUsd,
    })
    .from(nwpUsersTable)
    .where(
      and(
        eq(nwpUsersTable.status, "active"),
        eq(nwpUsersTable.package, "vip"),
        sql`${nwpUsersTable.investmentAmountUsd} IS NOT NULL`,
      ),
    );

  for (const user of vipUsers) {
    if (!user.investmentAmountUsd) continue;

    const amount = parseFloat(user.investmentAmountUsd);
    // 1–2% random variable bonus
    const bonusRate = 0.01 + Math.random() * 0.01;
    const bonusAmount = (amount * bonusRate).toFixed(2);

    await db.insert(nwpProfitLedgerTable).values({
      userId: user.id,
      creditDate: dateStr,
      amountUsd: bonusAmount,
      isWithdrawn: false,
    }).onConflictDoNothing();

    console.info(`[NWP Engine] VIP bonus for user ${user.id}: $${bonusAmount}`);
  }
}

// ── Aggregation helpers ───────────────────────────────────────────────────────
export async function getUserProfitSummary(userId: number): Promise<{
  totalProfitUsd: number;
  withdrawableProfitUsd: number;
  totalRewardUsd: number;
  withdrawableRewardUsd: number;
}> {
  const [profitRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${nwpProfitLedgerTable.amountUsd} AS NUMERIC)), 0)`,
      withdrawable: sql<string>`COALESCE(SUM(CASE WHEN ${nwpProfitLedgerTable.isWithdrawn} = false THEN CAST(${nwpProfitLedgerTable.amountUsd} AS NUMERIC) ELSE 0 END), 0)`,
    })
    .from(nwpProfitLedgerTable)
    .where(eq(nwpProfitLedgerTable.userId, userId));

  const [rewardRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${nwpRewardLedgerTable.amountUsd} AS NUMERIC)), 0)`,
      withdrawable: sql<string>`COALESCE(SUM(CASE WHEN ${nwpRewardLedgerTable.isWithdrawn} = false THEN CAST(${nwpRewardLedgerTable.amountUsd} AS NUMERIC) ELSE 0 END), 0)`,
    })
    .from(nwpRewardLedgerTable)
    .where(eq(nwpRewardLedgerTable.userId, userId));

  return {
    totalProfitUsd: Number(profitRow?.total ?? 0),
    withdrawableProfitUsd: Number(profitRow?.withdrawable ?? 0),
    totalRewardUsd: Number(rewardRow?.total ?? 0),
    withdrawableRewardUsd: Number(rewardRow?.withdrawable ?? 0),
  };
}
