import { Router } from "express";
import { db } from "@workspace/db";
import { estateCities } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

// GET /estate/cities
router.get("/", async (req, res) => {
  try {
    const popular = req.query.popular === "true";
    let cities;
    if (popular) {
      cities = await db.select().from(estateCities).where(eq(estateCities.isPopular, true));
    } else {
      cities = await db.select().from(estateCities);
    }
    res.json({ cities });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load cities" });
  }
});

export default router;
