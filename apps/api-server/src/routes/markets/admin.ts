import { Router } from "express";
import { db } from "@workspace/db";
import { marketsUsers, marketsDeposits } from "@workspace/db/schema";
import { eq, ilike, or, desc } from "drizzle-orm";
import type { Request, Response, NextFunction } from "express";

const router = Router();

function requireMarketsAdmin(req: Request, res: Response, next: NextFunction) {
  const key = req.headers["x-markets-admin-key"] || req.cookies?.["markets_admin"];
  if (!key || key !== process.env.AGENCY_ADMIN_KEY) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  next();
}

function safeUser(u: typeof marketsUsers.$inferSelect) {
  return {
    id: u.id, fullName: u.fullName, email: u.email, country: u.country,
    phone: u.phone ?? null, status: u.status, referralCode: u.referralCode,
    referredById: u.referredById ?? null, balanceUsd: u.balanceUsd,
    totalDepositsUsd: u.totalDepositsUsd, totalPnlUsd: u.totalPnlUsd,
    createdAt: u.createdAt,
  };
}

// GET /markets/admin/users
router.get("/users", requireMarketsAdmin, async (req, res) => {
  try {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const users = search
      ? await db.select().from(marketsUsers)
          .where(or(ilike(marketsUsers.email, `%${search}%`), ilike(marketsUsers.fullName, `%${search}%`)))
          .orderBy(desc(marketsUsers.createdAt))
      : await db.select().from(marketsUsers).orderBy(desc(marketsUsers.createdAt));

    res.json({ users: users.map(safeUser), total: users.length });
  } catch (err) {
    console.error("[Markets Admin] Users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// POST /markets/admin/users/:userId/deposit
router.post("/users/:userId/deposit", requireMarketsAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId as string, 10);
    const { amountUsd, note } = req.body as { amountUsd: number; note: string };

    if (!amountUsd || amountUsd <= 0) {
      res.status(400).json({ error: "amountUsd must be positive" });
      return;
    }

    const [user] = await db.select().from(marketsUsers).where(eq(marketsUsers.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const newBalance = (parseFloat(user.balanceUsd) + amountUsd).toFixed(2);
    const newDeposits = (parseFloat(user.totalDepositsUsd) + amountUsd).toFixed(2);

    const [updated] = await db.update(marketsUsers)
      .set({ balanceUsd: newBalance, totalDepositsUsd: newDeposits, updatedAt: new Date() })
      .where(eq(marketsUsers.id, userId))
      .returning();

    await db.insert(marketsDeposits).values({
      userId, amountUsd: String(amountUsd), note,
    });

    res.json({ user: safeUser(updated) });
  } catch (err) {
    console.error("[Markets Admin] Deposit error:", err);
    res.status(500).json({ error: "Failed to apply deposit" });
  }
});

export default router;
