import { Router } from "express";
import { db } from "@workspace/db";
import {
  estateProperties,
  estateUsers,
  estateSaved,
  estateInquiries,
} from "@workspace/db/schema";
import { eq, and, gte, lte, ilike, or, sql } from "drizzle-orm";
import { getEstateSession } from "./auth";
import type { Request, Response } from "express";

const router = Router();

function buildPropertyResult(p: typeof estateProperties.$inferSelect, savedIds?: Set<number>) {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    purpose: p.purpose,
    type: p.type,
    city: p.city,
    location: p.location,
    area: p.area,
    areaUnit: p.areaUnit,
    price: p.price,
    beds: p.beds,
    baths: p.baths,
    images: p.images,
    features: p.features,
    status: p.status,
    isFeatured: p.isFeatured,
    views: p.views,
    userId: p.userId,
    createdAt: p.createdAt,
    isSaved: savedIds ? savedIds.has(p.id) : false,
  };
}

// GET /estate/properties
router.get("/", async (req, res) => {
  try {
    const { purpose, type, city, minPrice, maxPrice, minBeds, search } = req.query as Record<string, string>;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const offset = (page - 1) * limit;

    const conditions = [eq(estateProperties.status, "approved")];

    if (purpose) conditions.push(eq(estateProperties.purpose, purpose as "sale" | "rent"));
    if (type) conditions.push(eq(estateProperties.type, type as typeof estateProperties.$inferSelect["type"]));
    if (city) conditions.push(ilike(estateProperties.city, `%${city}%`));
    if (minPrice) conditions.push(gte(estateProperties.price, minPrice));
    if (maxPrice) conditions.push(lte(estateProperties.price, maxPrice));
    if (minBeds) conditions.push(gte(sql`${estateProperties.beds}`, parseInt(minBeds)));
    if (search) {
      conditions.push(
        or(
          ilike(estateProperties.title, `%${search}%`),
          ilike(estateProperties.location, `%${search}%`),
          ilike(estateProperties.city, `%${search}%`)
        )!
      );
    }

    const properties = await db.select().from(estateProperties)
      .where(and(...conditions))
      .limit(limit)
      .offset(offset)
      .orderBy(sql`${estateProperties.isFeatured} desc, ${estateProperties.createdAt} desc`);

    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(estateProperties)
      .where(and(...conditions));

    // Get saved IDs if user is logged in
    const user = await getEstateSession(req);
    let savedIds = new Set<number>();
    if (user) {
      const saved = await db.select({ propertyId: estateSaved.propertyId }).from(estateSaved).where(eq(estateSaved.userId, user.id));
      savedIds = new Set(saved.map(s => s.propertyId));
    }

    res.json({
      properties: properties.map(p => buildPropertyResult(p, savedIds)),
      total: Number(count),
      page,
      limit,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load properties" });
  }
});

// GET /estate/properties/saved
router.get("/saved", async (req, res) => {
  try {
    const user = await getEstateSession(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const saved = await db.select({ propertyId: estateSaved.propertyId }).from(estateSaved).where(eq(estateSaved.userId, user.id));
    const ids = saved.map(s => s.propertyId);
    if (!ids.length) { res.json({ properties: [], total: 0, page: 1, limit: 20 }); return; }

    const properties = await db.select().from(estateProperties)
      .where(sql`${estateProperties.id} = ANY(${sql.raw(`ARRAY[${ids.join(",")}]`)})`);

    const savedSet = new Set(ids);
    res.json({
      properties: properties.map(p => buildPropertyResult(p, savedSet)),
      total: properties.length,
      page: 1,
      limit: 20,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// GET /estate/properties/:id
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [property] = await db.select().from(estateProperties).where(eq(estateProperties.id, id)).limit(1);
    if (!property) { res.status(404).json({ error: "Not found" }); return; }

    // Increment views
    await db.update(estateProperties).set({ views: property.views + 1 }).where(eq(estateProperties.id, id));

    const [owner] = await db.select({ id: estateUsers.id, name: estateUsers.name, phone: estateUsers.phone, avatarUrl: estateUsers.avatarUrl, city: estateUsers.city, role: estateUsers.role }).from(estateUsers).where(eq(estateUsers.id, property.userId)).limit(1);

    const user = await getEstateSession(req);
    let isSaved = false;
    if (user) {
      const [saved] = await db.select().from(estateSaved).where(and(eq(estateSaved.userId, user.id), eq(estateSaved.propertyId, id))).limit(1);
      isSaved = !!saved;
    }

    res.json({ ...buildPropertyResult(property), owner: owner ?? null, isSaved });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /estate/properties
router.post("/", async (req, res) => {
  try {
    const user = await getEstateSession(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { title, description, purpose, type, city, location, area, areaUnit, price, beds, baths, images, features } = req.body;
    if (!title || !purpose || !type || !city || !location || !area || !price) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [property] = await db.insert(estateProperties).values({
      userId: user.id,
      title,
      description: description ?? null,
      purpose,
      type,
      city,
      location,
      area: String(area),
      areaUnit: areaUnit ?? "marla",
      price: String(price),
      beds: beds ? parseInt(beds) : null,
      baths: baths ? parseInt(baths) : null,
      images: Array.isArray(images) ? images : [],
      features: Array.isArray(features) ? features : [],
      status: "pending",
    }).returning();

    res.status(201).json(buildPropertyResult(property));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit property" });
  }
});

// POST /estate/properties/:id/save
router.post("/:id/save", async (req, res) => {
  try {
    const user = await getEstateSession(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const propertyId = parseInt(req.params.id);
    const [existing] = await db.select().from(estateSaved).where(and(eq(estateSaved.userId, user.id), eq(estateSaved.propertyId, propertyId))).limit(1);

    if (existing) {
      await db.delete(estateSaved).where(eq(estateSaved.id, existing.id));
      res.json({ saved: false });
    } else {
      await db.insert(estateSaved).values({ userId: user.id, propertyId });
      res.json({ saved: true });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

// POST /estate/properties/:id/inquire
router.post("/:id/inquire", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const { name, email, phone, message } = req.body;
    if (!name || !email || !phone || !message) {
      res.status(400).json({ error: "All fields required" });
      return;
    }

    const user = await getEstateSession(req);
    await db.insert(estateInquiries).values({
      propertyId,
      fromUserId: user?.id ?? null,
      name,
      email,
      phone,
      message,
    });

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
