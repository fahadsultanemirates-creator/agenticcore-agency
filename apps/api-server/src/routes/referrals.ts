import { Router, type IRouter } from "express";
import { eq, sql, desc, lt, and, not } from "drizzle-orm";
import { db, appUsersTable, referralRecordsTable } from "@workspace/db";
import {
  GetMyProfileResponse,
  UpdateMyProfileBody,
  UpdateMyProfileResponse,
  GetMyReferralsResponse,
  TrackReferralBody,
  TrackReferralResponse,
  GetLeaderboardResponse,
  GetLeaderboardQueryParams,
  GetDashboardStatsResponse,
  GetRecentActivityResponse,
  GetRecentActivityQueryParams,
} from "@workspace/api-zod";
import { generateReferralCode } from "../lib/referralCode";

const router: IRouter = Router();

// Upsert the current authenticated user into app_users, returning the record
async function getOrCreateAppUser(replitUserId: string, displayName: string, profileImageUrl: string | null) {
  const existing = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.replitUserId, replitUserId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const code = generateReferralCode();
  const [created] = await db
    .insert(appUsersTable)
    .values({ replitUserId, displayName, profileImageUrl, referralCode: code })
    .returning();
  return created;
}

// Compute rank for a user (1-indexed, lower is better)
async function getUserRank(userId: number, userPoints: number): Promise<number> {
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(appUsersTable)
    .where(sql`${appUsersTable.points} > ${userPoints}`);
  return (result[0]?.count ?? 0) + 1;
}

// GET /api/me
router.get("/me", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const appUser = await getOrCreateAppUser(
    req.user.id,
    `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || req.user.email || "User",
    req.user.profileImageUrl ?? null,
  );

  const rank = await getUserRank(appUser.id, appUser.points);
  const referralCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referralRecordsTable)
    .where(eq(referralRecordsTable.referrerId, appUser.id));

  res.json(GetMyProfileResponse.parse({
    id: appUser.id,
    replitUserId: appUser.replitUserId,
    displayName: appUser.displayName,
    profileImageUrl: appUser.profileImageUrl,
    referralCode: appUser.referralCode,
    points: appUser.points,
    rank,
    totalReferrals: referralCount[0]?.count ?? 0,
    createdAt: appUser.createdAt,
  }));
});

// PATCH /api/me
router.patch("/me", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = UpdateMyProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const appUser = await getOrCreateAppUser(
    req.user.id,
    parsed.data.displayName ?? (`${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || "User"),
    req.user.profileImageUrl ?? null,
  );

  const updates: Partial<typeof appUsersTable.$inferInsert> = {};
  if (parsed.data.displayName) updates.displayName = parsed.data.displayName;

  const [updated] = await db
    .update(appUsersTable)
    .set(updates)
    .where(eq(appUsersTable.id, appUser.id))
    .returning();

  const rank = await getUserRank(updated.id, updated.points);
  const referralCount = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(referralRecordsTable)
    .where(eq(referralRecordsTable.referrerId, updated.id));

  res.json(UpdateMyProfileResponse.parse({
    id: updated.id,
    replitUserId: updated.replitUserId,
    displayName: updated.displayName,
    profileImageUrl: updated.profileImageUrl,
    referralCode: updated.referralCode,
    points: updated.points,
    rank,
    totalReferrals: referralCount[0]?.count ?? 0,
    createdAt: updated.createdAt,
  }));
});

// GET /api/me/referrals
router.get("/me/referrals", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const appUser = await getOrCreateAppUser(
    req.user.id,
    `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || "User",
    req.user.profileImageUrl ?? null,
  );

  const referrals = await db
    .select({
      id: referralRecordsTable.id,
      refereeName: appUsersTable.displayName,
      refereeProfileImageUrl: appUsersTable.profileImageUrl,
      createdAt: referralRecordsTable.createdAt,
    })
    .from(referralRecordsTable)
    .innerJoin(appUsersTable, eq(appUsersTable.id, referralRecordsTable.refereeId))
    .where(eq(referralRecordsTable.referrerId, appUser.id))
    .orderBy(desc(referralRecordsTable.createdAt));

  res.json(GetMyReferralsResponse.parse(referrals));
});

// POST /api/referrals/track
router.post("/referrals/track", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parsed = TrackReferralBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentAppUser = await getOrCreateAppUser(
    req.user.id,
    `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || "User",
    req.user.profileImageUrl ?? null,
  );

  // Check if already been referred
  const alreadyReferred = await db
    .select()
    .from(referralRecordsTable)
    .where(eq(referralRecordsTable.refereeId, currentAppUser.id))
    .limit(1);

  if (alreadyReferred.length > 0) {
    res.status(400).json({ error: "You have already been referred by someone." });
    return;
  }

  // Find referrer by code
  const referrers = await db
    .select()
    .from(appUsersTable)
    .where(eq(appUsersTable.referralCode, parsed.data.referralCode.toUpperCase()))
    .limit(1);

  if (referrers.length === 0) {
    res.status(400).json({ error: "Invalid referral code." });
    return;
  }

  const referrer = referrers[0];

  // Can't refer yourself
  if (referrer.id === currentAppUser.id) {
    res.status(400).json({ error: "You cannot use your own referral code." });
    return;
  }

  // Create referral record and award points to referrer
  await db.insert(referralRecordsTable).values({
    referrerId: referrer.id,
    refereeId: currentAppUser.id,
  });

  await db
    .update(appUsersTable)
    .set({ points: sql`${appUsersTable.points} + 100` })
    .where(eq(appUsersTable.id, referrer.id));

  res.json(TrackReferralResponse.parse({ success: true, referrerName: referrer.displayName }));
});

// GET /api/leaderboard
router.get("/leaderboard", async (req, res): Promise<void> => {
  const params = GetLeaderboardQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 20) : 20;

  const leaderboard = await db
    .select({
      userId: appUsersTable.id,
      displayName: appUsersTable.displayName,
      profileImageUrl: appUsersTable.profileImageUrl,
      points: appUsersTable.points,
      totalReferrals: sql<number>`(select count(*)::int from referral_records where referrer_id = ${appUsersTable.id})`,
    })
    .from(appUsersTable)
    .orderBy(desc(appUsersTable.points), appUsersTable.createdAt)
    .limit(Math.min(limit, 100));

  const entries = leaderboard.map((entry, index) => ({
    rank: index + 1,
    ...entry,
  }));

  res.json(GetLeaderboardResponse.parse(entries));
});

// GET /api/stats
router.get("/stats", async (req, res): Promise<void> => {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const appUser = await getOrCreateAppUser(
    req.user.id,
    `${req.user.firstName ?? ""} ${req.user.lastName ?? ""}`.trim() || "User",
    req.user.profileImageUrl ?? null,
  );

  const [rank, referralCount, totalUsers, weeklyReferrals] = await Promise.all([
    getUserRank(appUser.id, appUser.points),
    db.select({ count: sql<number>`count(*)::int` }).from(referralRecordsTable).where(eq(referralRecordsTable.referrerId, appUser.id)),
    db.select({ count: sql<number>`count(*)::int` }).from(appUsersTable),
    db.select({ count: sql<number>`count(*)::int` }).from(referralRecordsTable).where(
      and(
        eq(referralRecordsTable.referrerId, appUser.id),
        sql`${referralRecordsTable.createdAt} >= now() - interval '7 days'`,
      )
    ),
  ]);

  // Build referral link using request host
  const protocol = req.headers["x-forwarded-proto"] ?? "https";
  const host = req.headers["x-forwarded-host"] ?? req.headers.host ?? "localhost";
  const referralLink = `${protocol}://${host}/?ref=${appUser.referralCode}`;

  res.json(GetDashboardStatsResponse.parse({
    totalReferrals: referralCount[0]?.count ?? 0,
    points: appUser.points,
    rank,
    totalUsers: totalUsers[0]?.count ?? 1,
    referralCode: appUser.referralCode,
    referralLink,
    thisWeekReferrals: weeklyReferrals[0]?.count ?? 0,
    allTimeRank: rank,
  }));
});

// GET /api/activity
router.get("/activity", async (req, res): Promise<void> => {
  const params = GetRecentActivityQueryParams.safeParse(req.query);
  const limit = params.success ? (params.data.limit ?? 20) : 20;

  const referrer = appUsersTable;
  const referee = db.$with("referee_users").as(db.select().from(appUsersTable));

  const activity = await db
    .select({
      id: referralRecordsTable.id,
      referrerName: sql<string>`r.display_name`,
      refereeName: sql<string>`e.display_name`,
      referrerProfileImageUrl: sql<string | null>`r.profile_image_url`,
      refereeProfileImageUrl: sql<string | null>`e.profile_image_url`,
      createdAt: referralRecordsTable.createdAt,
    })
    .from(referralRecordsTable)
    .innerJoin(sql`app_users r`, sql`r.id = ${referralRecordsTable.referrerId}`)
    .innerJoin(sql`app_users e`, sql`e.id = ${referralRecordsTable.refereeId}`)
    .orderBy(desc(referralRecordsTable.createdAt))
    .limit(Math.min(limit, 50));

  res.json(GetRecentActivityResponse.parse(activity));
});

export default router;
