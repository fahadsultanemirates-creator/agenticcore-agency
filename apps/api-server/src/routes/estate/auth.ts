import { Router } from "express";
import { db } from "@workspace/db";
import { estateUsers } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import type { Request, Response } from "express";

const router = Router();

const SESSION_COOKIE = "estate_sid";
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: 30 * 24 * 60 * 60 * 1000,
};

export function safeUser(u: typeof estateUsers.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    role: u.role,
    city: u.city ?? null,
    avatarUrl: u.avatarUrl ?? null,
    bio: u.bio ?? null,
    isVerified: u.isVerified,
    createdAt: u.createdAt,
  };
}

export async function getEstateSession(req: Request) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  const [user] = await db
    .select()
    .from(estateUsers)
    .where(eq(estateUsers.sessionToken, token))
    .limit(1);
  return user ?? null;
}

// POST /estate/auth/register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, phone, city } = req.body as {
      name: string; email: string; password: string;
      role?: string; phone?: string; city?: string;
    };

    if (!name || !email || !password) {
      res.status(400).json({ error: "name, email, and password are required" });
      return;
    }

    const validRoles = ["buyer", "seller", "agent", "developer"];
    const userRole = (validRoles.includes(role ?? "") ? role : "buyer") as "buyer" | "seller" | "agent" | "developer";

    const [existing] = await db.select().from(estateUsers).where(eq(estateUsers.email, email.toLowerCase())).limit(1);
    if (existing) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const sessionToken = nanoid(48);

    const [user] = await db.insert(estateUsers).values({
      name,
      email: email.toLowerCase(),
      passwordHash,
      sessionToken,
      role: userRole,
      phone: phone ?? null,
      city: city ?? null,
    }).returning();

    res.cookie(SESSION_COOKIE, sessionToken, COOKIE_OPTS);
    res.status(201).json({ user: safeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /estate/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };
    if (!email || !password) {
      res.status(400).json({ error: "email and password required" });
      return;
    }

    const [user] = await db.select().from(estateUsers).where(eq(estateUsers.email, email.toLowerCase())).limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }

    const sessionToken = nanoid(48);
    await db.update(estateUsers).set({ sessionToken }).where(eq(estateUsers.id, user.id));

    res.cookie(SESSION_COOKIE, sessionToken, COOKIE_OPTS);
    res.json({ user: safeUser({ ...user, sessionToken }) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /estate/auth/logout
router.post("/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) {
    await db.update(estateUsers).set({ sessionToken: null }).where(eq(estateUsers.sessionToken, token)).catch(() => {});
  }
  res.clearCookie(SESSION_COOKIE);
  res.json({ ok: true });
});

// GET /estate/auth/me
router.get("/me", async (req, res) => {
  try {
    const user = await getEstateSession(req);
    if (!user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    res.json(safeUser(user));
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

export default router;
