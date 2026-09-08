import { Router } from "express";
import { db } from "@workspace/db";
import { estateDevelopers, estateProjects, estateUsers } from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";

const router = Router();

// GET /estate/developers
router.get("/", async (req, res) => {
  try {
    const { city } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];
    if (city) conditions.push(ilike(estateDevelopers.city, `%${city}%`) as any);

    const developers = await db.select().from(estateDevelopers)
      .where(conditions.length ? and(...conditions) : undefined)
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(estateDevelopers)
      .where(conditions.length ? and(...conditions) : undefined);

    res.json({ developers, total: Number(count), page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /estate/developers/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [developer] = await db.select().from(estateDevelopers).where(eq(estateDevelopers.id, id)).limit(1);
    if (!developer) { res.status(404).json({ error: "Not found" }); return; }

    const projects = await db.select().from(estateProjects)
      .where(and(eq(estateProjects.developerId, id), eq(estateProjects.status, "approved")))
      .orderBy(sql`${estateProjects.createdAt} desc`);

    res.json({ developer, projects });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
