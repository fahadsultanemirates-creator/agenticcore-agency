import { Router } from "express";
import { db } from "@workspace/db";
import { estateUsers, estateProperties } from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

const router = Router();

// GET /estate/agents
router.get("/", async (req, res) => {
  try {
    const { city, search } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions = [
      sql`${estateUsers.role} IN ('agent', 'developer')`,
    ];
    if (city) conditions.push(ilike(estateUsers.city, `%${city}%`));
    if (search) conditions.push(ilike(estateUsers.name, `%${search}%`));

    const agents = await db.select({
      id: estateUsers.id,
      name: estateUsers.name,
      role: estateUsers.role,
      city: estateUsers.city,
      avatarUrl: estateUsers.avatarUrl,
      bio: estateUsers.bio,
      phone: estateUsers.phone,
      isVerified: estateUsers.isVerified,
      createdAt: estateUsers.createdAt,
    }).from(estateUsers)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(estateUsers).where(and(...conditions));

    // Attach listing counts
    const agentIds = agents.map(a => a.id);
    let listingCounts: Record<number, number> = {};
    if (agentIds.length) {
      const counts = await db.select({
        userId: estateProperties.userId,
        count: sql<number>`count(*)`,
      }).from(estateProperties)
        .where(and(
          eq(estateProperties.status, "approved"),
          sql`${estateProperties.userId} = ANY(ARRAY[${sql.raw(agentIds.join(","))}])`
        ))
        .groupBy(estateProperties.userId);
      counts.forEach(c => { listingCounts[c.userId] = Number(c.count); });
    }

    res.json({
      agents: agents.map(a => ({ ...a, listingCount: listingCounts[a.id] ?? 0 })),
      total: Number(count),
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /estate/agents/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [agent] = await db.select({
      id: estateUsers.id,
      name: estateUsers.name,
      role: estateUsers.role,
      city: estateUsers.city,
      avatarUrl: estateUsers.avatarUrl,
      bio: estateUsers.bio,
      phone: estateUsers.phone,
      isVerified: estateUsers.isVerified,
      createdAt: estateUsers.createdAt,
    }).from(estateUsers).where(eq(estateUsers.id, id)).limit(1);

    if (!agent || (agent.role !== "agent" && agent.role !== "developer")) {
      res.status(404).json({ error: "Agent not found" }); return;
    }

    const listings = await db.select().from(estateProperties)
      .where(and(eq(estateProperties.userId, id), eq(estateProperties.status, "approved")))
      .limit(12)
      .orderBy(sql`${estateProperties.createdAt} desc`);

    res.json({ agent, listings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
