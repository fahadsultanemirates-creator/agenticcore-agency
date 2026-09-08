import { Router } from "express";
import { db } from "@workspace/db";
import {
  estateProperties,
  estateProjects,
  estateUsers,
  estateDevelopers,
} from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { getEstateSession } from "./auth";

const router = Router();

const ADMIN_PASSWORD = process.env.ESTATE_ADMIN_PASSWORD || "estate_admin_2024";

async function requireAdmin(req: any, res: any): Promise<boolean> {
  const user = await getEstateSession(req);
  if (user && user.role === "admin") return true;

  // Also allow password header for convenience
  const pw = req.headers["x-admin-password"] || req.headers["x-estate-admin-password"];
  if (pw === ADMIN_PASSWORD) return true;

  res.status(403).json({ error: "Admin access required" });
  return false;
}

// GET /estate/admin/stats
router.get("/stats", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const [propStats] = await db.select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where status = 'pending')`,
      approved: sql<number>`count(*) filter (where status = 'approved')`,
      rejected: sql<number>`count(*) filter (where status = 'rejected')`,
    }).from(estateProperties);

    const [projStats] = await db.select({
      total: sql<number>`count(*)`,
      pending: sql<number>`count(*) filter (where status = 'pending')`,
    }).from(estateProjects);

    const [userStats] = await db.select({
      total: sql<number>`count(*)`,
      buyers: sql<number>`count(*) filter (where role = 'buyer')`,
      sellers: sql<number>`count(*) filter (where role = 'seller')`,
      agents: sql<number>`count(*) filter (where role = 'agent')`,
      developers: sql<number>`count(*) filter (where role = 'developer')`,
    }).from(estateUsers);

    res.json({
      properties: propStats,
      projects: projStats,
      users: userStats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /estate/admin/properties
router.get("/properties", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { status } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions = status
      ? [eq(estateProperties.status, status as "pending" | "approved" | "rejected")]
      : [];

    const properties = await db.select().from(estateProperties)
      .where(conditions.length ? conditions[0] : undefined)
      .limit(limit).offset(offset)
      .orderBy(sql`${estateProperties.createdAt} desc`);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(estateProperties)
      .where(conditions.length ? conditions[0] : undefined);

    // Attach user names
    const userIds = [...new Set(properties.map(p => p.userId))];
    let userMap: Record<number, string> = {};
    if (userIds.length) {
      const users = await db.select({ id: estateUsers.id, name: estateUsers.name, email: estateUsers.email }).from(estateUsers)
        .where(sql`${estateUsers.id} = ANY(ARRAY[${sql.raw(userIds.join(","))}])`);
      users.forEach(u => { userMap[u.id] = u.name; });
    }

    res.json({
      properties: properties.map(p => ({ ...p, ownerName: userMap[p.userId] ?? null })),
      total: Number(count),
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /estate/admin/properties/:id/approve
router.post("/properties/:id/approve", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id);
    await db.update(estateProperties).set({ status: "approved" }).where(eq(estateProperties.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /estate/admin/properties/:id/reject
router.post("/properties/:id/reject", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id);
    await db.update(estateProperties).set({ status: "rejected" }).where(eq(estateProperties.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /estate/admin/projects
router.get("/projects", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { status } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions = status
      ? [eq(estateProjects.status, status as "pending" | "approved" | "rejected")]
      : [];

    const projects = await db.select().from(estateProjects)
      .where(conditions.length ? conditions[0] : undefined)
      .limit(limit).offset(offset)
      .orderBy(sql`${estateProjects.createdAt} desc`);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(estateProjects)
      .where(conditions.length ? conditions[0] : undefined);

    const devIds = [...new Set(projects.map(p => p.developerId))];
    let devMap: Record<number, string> = {};
    if (devIds.length) {
      const devs = await db.select({ id: estateDevelopers.id, companyName: estateDevelopers.companyName }).from(estateDevelopers)
        .where(sql`${estateDevelopers.id} = ANY(ARRAY[${sql.raw(devIds.join(","))}])`);
      devs.forEach(d => { devMap[d.id] = d.companyName; });
    }

    res.json({
      projects: projects.map(p => ({ ...p, developerName: devMap[p.developerId] ?? null })),
      total: Number(count),
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /estate/admin/projects/:id/approve
router.post("/projects/:id/approve", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id);
    await db.update(estateProjects).set({ status: "approved" }).where(eq(estateProjects.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /estate/admin/projects/:id/reject
router.post("/projects/:id/reject", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;
    const id = parseInt(req.params.id);
    await db.update(estateProjects).set({ status: "rejected" }).where(eq(estateProjects.id, id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /estate/admin/users
router.get("/users", async (req, res) => {
  try {
    if (!(await requireAdmin(req, res))) return;

    const { role } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions = role
      ? [eq(estateUsers.role, role as "buyer" | "seller" | "agent" | "developer" | "admin")]
      : [];

    const users = await db.select({
      id: estateUsers.id,
      name: estateUsers.name,
      email: estateUsers.email,
      role: estateUsers.role,
      city: estateUsers.city,
      phone: estateUsers.phone,
      isVerified: estateUsers.isVerified,
      createdAt: estateUsers.createdAt,
    }).from(estateUsers)
      .where(conditions.length ? conditions[0] : undefined)
      .limit(limit).offset(offset)
      .orderBy(sql`${estateUsers.createdAt} desc`);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(estateUsers)
      .where(conditions.length ? conditions[0] : undefined);

    res.json({ users, total: Number(count), page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
