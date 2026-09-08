import { Router } from "express";
import { db } from "@workspace/db";
import { estateProjects, estateDevelopers } from "@workspace/db/schema";
import { eq, and, ilike, sql } from "drizzle-orm";
import { getEstateSession } from "./auth";

const router = Router();

// GET /estate/projects
router.get("/", async (req, res) => {
  try {
    const { projectStatus, city, type } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = 20;
    const offset = (page - 1) * limit;

    const conditions = [eq(estateProjects.status, "approved")];
    if (projectStatus) conditions.push(eq(estateProjects.projectStatus, projectStatus as "upcoming" | "new_launch" | "running"));
    if (city) conditions.push(ilike(estateProjects.city, `%${city}%`) as any);
    if (type) conditions.push(eq(estateProjects.type, type as typeof estateProjects.$inferSelect["type"]));

    const projects = await db.select().from(estateProjects)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${estateProjects.createdAt} desc`);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(estateProjects).where(and(...conditions));

    // Attach developer names
    const devIds = [...new Set(projects.map(p => p.developerId))];
    let devMap: Record<number, string> = {};
    if (devIds.length) {
      const devs = await db.select({ id: estateDevelopers.id, companyName: estateDevelopers.companyName, logoUrl: estateDevelopers.logoUrl }).from(estateDevelopers)
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

// GET /estate/projects/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [project] = await db.select().from(estateProjects).where(eq(estateProjects.id, id)).limit(1);
    if (!project) { res.status(404).json({ error: "Not found" }); return; }

    const [developer] = await db.select().from(estateDevelopers).where(eq(estateDevelopers.id, project.developerId)).limit(1);

    res.json({ ...project, developer: developer ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /estate/projects
router.post("/", async (req, res) => {
  try {
    const user = await getEstateSession(req);
    if (!user || user.role !== "developer") {
      res.status(403).json({ error: "Developer account required" }); return;
    }

    const [developer] = await db.select().from(estateDevelopers)
      .where(eq(estateDevelopers.userId, user.id)).limit(1);

    if (!developer) { res.status(403).json({ error: "No developer profile found" }); return; }

    const { title, description, city, location, type, projectStatus, images, minPrice, maxPrice, paymentPlan, progressPercent, deliveryDate, totalUnits } = req.body;

    if (!title || !city || !type || !projectStatus) {
      res.status(400).json({ error: "Missing required fields" }); return;
    }

    const [project] = await db.insert(estateProjects).values({
      developerId: developer.id,
      title,
      description: description ?? null,
      city,
      location: location ?? null,
      type,
      projectStatus,
      images: Array.isArray(images) ? images : [],
      minPrice: minPrice ? String(minPrice) : null,
      maxPrice: maxPrice ? String(maxPrice) : null,
      paymentPlan: paymentPlan ?? null,
      progressPercent: parseInt(progressPercent) || 0,
      deliveryDate: deliveryDate ?? null,
      totalUnits: totalUnits ? parseInt(totalUnits) : null,
      status: "pending",
    }).returning();

    res.status(201).json(project);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit project" });
  }
});

export default router;
