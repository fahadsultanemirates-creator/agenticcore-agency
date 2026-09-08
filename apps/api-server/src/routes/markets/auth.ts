import { Router } from "express";
import { db } from "@workspace/db";
import { marketsUsers } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";

const router = Router();

const SESSION_COOKIE = "markets_sid";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

function safeUser(u: typeof marketsUsers.$inferSelect) {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    country: u.country,
    phone: u.phone ?? null,
    status: u.status,
    referralCode: u.referralCode,
    referredById: u.referredById ?? null,
    balanceUsd: u.balanceUsd,
    totalDepositsUsd: u.totalDepositsUsd,
    totalPnlUsd: u.totalPnlUsd,
    createdAt: u.createdAt,
  };
}

async function getSession(req: Request) {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (!sid) return null;
  const [user] = await db
    .select()
    .from(marketsUsers)
    .where(eq(marketsUsers.id, parseInt(sid, 10)))
    .limit(1);
  return user ?? null;
}

export { getSession };

// POST /markets/auth/register
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password, country, phone, referralCode } = req.body as {
      fullName: string; email: string; password: string; country: string;
      phone?: string; referralCode?: string;
    };

    if (!fullName || !email || !password || !country) {
      res.status(400).json({ error: "fullName, email, password and country are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const [existing] = await db
      .select({ id: marketsUsers.id })
      .from(marketsUsers)
      .where(eq(marketsUsers.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "Email already registered" });
      return;
    }

    // Resolve referrer
    let referredById: number | null = null;
    if (referralCode) {
      const [referrer] = await db
        .select({ id: marketsUsers.id })
        .from(marketsUsers)
        .where(eq(marketsUsers.referralCode, referralCode.toUpperCase()))
        .limit(1);
      if (referrer) referredById = referrer.id;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const code = nanoid(8).toUpperCase();

    const [user] = await db
      .insert(marketsUsers)
      .values({
        fullName,
        email: email.toLowerCase(),
        passwordHash,
        country,
        phone: phone ?? null,
        referralCode: code,
        referredById,
        status: "active",
      })
      .returning();

    res.cookie(SESSION_COOKIE, String(user.id), COOKIE_OPTS);
    res.status(201).json({ user: safeUser(user) });
  } catch (err) {
    console.error("[Markets Auth] Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /markets/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    const [user] = await db
      .select()
      .from(marketsUsers)
      .where(eq(marketsUsers.email, (email ?? "").toLowerCase()))
      .limit(1);

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status === "suspended") {
      res.status(403).json({ error: "Account is suspended" });
      return;
    }

    res.cookie(SESSION_COOKIE, String(user.id), COOKIE_OPTS);
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[Markets Auth] Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /markets/auth/logout
router.post("/logout", (_req, res) => {
  res.clearCookie(SESSION_COOKIE);
  res.json({ success: true });
});

// GET /markets/auth/me
router.get("/me", async (req, res) => {
  try {
    const user = await getSession(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }
    res.json({ user: safeUser(user) });
  } catch (err) {
    console.error("[Markets Auth] Me error:", err);
    res.status(500).json({ error: "Failed to fetch session" });
  }
});

export default router;
