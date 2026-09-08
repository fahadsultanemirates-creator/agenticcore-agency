import { Router } from "express";
import bcrypt from "bcryptjs";
import { nanoid } from "nanoid";
import { db } from "@workspace/db";
import { agencyCustomersTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  createAgencyToken,
  verifyAgencyToken,
  AGENCY_COOKIE,
  COOKIE_OPTS,
} from "../../lib/agencyJwt";
import {
  sendAgencyWelcomeEmail,
  sendAgencyPasswordResetEmail,
} from "../../lib/agencyEmailService";
import { requireAgencyAuth } from "../../middlewares/agencyAuthMiddleware";

const router = Router();

function safeCustomer(c: typeof agencyCustomersTable.$inferSelect) {
  return {
    id: c.id,
    email: c.email,
    fullName: c.fullName,
    company: c.company ?? null,
    creditBalance: c.creditBalance,
    status: c.status,
    createdAt: c.createdAt,
  };
}

// POST /agency/auth/register
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName, company } = req.body as Record<string, string>;

    if (!email || !password || !fullName) {
      res.status(400).json({ error: "email, password, and fullName are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const [existing] = await db
      .select({ id: agencyCustomersTable.id })
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const [customer] = await db
      .insert(agencyCustomersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        fullName,
        company: company || null,
        creditBalance: 0,
        status: "active",
      })
      .returning();

    const token = createAgencyToken(customer.id, customer.email);
    res.cookie(AGENCY_COOKIE, token, COOKIE_OPTS);

    // Fire and forget
    sendAgencyWelcomeEmail({ toEmail: customer.email, fullName: customer.fullName }).catch(
      (e) => console.error("[Agency] Welcome email error:", e),
    );

    res.status(201).json({ customer: safeCustomer(customer), token });
  } catch (err) {
    console.error("[Agency Auth] Register error:", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /agency/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as Record<string, string>;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [customer] = await db
      .select()
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.email, email.toLowerCase()))
      .limit(1);

    if (!customer) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (customer.status === "suspended") {
      res.status(401).json({ error: "Your account has been suspended. Please contact support." });
      return;
    }

    const token = createAgencyToken(customer.id, customer.email);
    res.cookie(AGENCY_COOKIE, token, COOKIE_OPTS);

    res.json({ customer: safeCustomer(customer), token });
  } catch (err) {
    console.error("[Agency Auth] Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /agency/auth/logout
router.post("/logout", (req, res) => {
  res.clearCookie(AGENCY_COOKIE, { path: "/" });
  res.json({ ok: true });
});

// GET /agency/auth/me
router.get("/me", requireAgencyAuth, async (req, res) => {
  try {
    const [customer] = await db
      .select()
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.id, req.agencyUser!.id))
      .limit(1);

    if (!customer) {
      res.clearCookie(AGENCY_COOKIE, { path: "/" });
      res.status(401).json({ error: "Account not found" });
      return;
    }

    const token = createAgencyToken(customer.id, customer.email);
    res.json({ customer: safeCustomer(customer), token });
  } catch (err) {
    console.error("[Agency Auth] Me error:", err);
    res.status(500).json({ error: "Failed to fetch account" });
  }
});

// POST /agency/auth/forgot-password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const [customer] = await db
      .select()
      .from(agencyCustomersTable)
      .where(eq(agencyCustomersTable.email, email.toLowerCase()))
      .limit(1);

    // Always return OK to prevent email enumeration
    res.json({ ok: true });

    if (!customer) return;

    const token = nanoid(48);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(agencyCustomersTable)
      .set({ resetToken: token, resetTokenExpiresAt: expiresAt })
      .where(eq(agencyCustomersTable.id, customer.id));

    sendAgencyPasswordResetEmail({
      toEmail: customer.email,
      fullName: customer.fullName,
      token,
    }).catch((e) => console.error("[Agency] Reset email error:", e));
  } catch (err) {
    console.error("[Agency Auth] Forgot password error:", err);
  }
});

// POST /agency/auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body as { token: string; password: string };

    if (!token || !password) {
      res.status(400).json({ error: "Token and password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const [customer] = await db
      .select()
      .from(agencyCustomersTable)
      .where(
        and(
          eq(agencyCustomersTable.resetToken, token),
          gt(agencyCustomersTable.resetTokenExpiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!customer) {
      res.status(400).json({ error: "Invalid or expired reset link" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(agencyCustomersTable)
      .set({ passwordHash, resetToken: null, resetTokenExpiresAt: null })
      .where(eq(agencyCustomersTable.id, customer.id));

    res.json({ ok: true });
  } catch (err) {
    console.error("[Agency Auth] Reset password error:", err);
    res.status(500).json({ error: "Password reset failed" });
  }
});

export default router;
