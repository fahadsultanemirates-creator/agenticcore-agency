import { Router } from "express";
import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { nwpUsersTable, nwpPasswordResetTokensTable } from "@workspace/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { nanoid } from "nanoid";
import {
  createCustomerToken,
  CUSTOMER_COOKIE,
  COOKIE_OPTS,
} from "../../lib/nwpJwt";
import {
  sendWelcomeEmail,
  sendNewApplicationAlert,
  sendPasswordResetEmail,
} from "../../lib/emailService";
import { requireNwpAuth } from "../../middlewares/nwpAuthMiddleware";

const router = Router();

// Company master referral code — joining via this code carries no 10% upfront bonus
export const COMPANY_MASTER_CODE = process.env.NWP_MASTER_CODE || "NWPMASTER";

// ── POST /nwp/auth/register ──────────────────────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      password,
      mobile,
      country,
      address,
      bnbWallet,
      referralCode,
    } = req.body as Record<string, string>;

    // Basic validation
    if (
      !fullName ||
      !email ||
      !password ||
      !mobile ||
      !country ||
      !address ||
      !bnbWallet ||
      !referralCode
    ) {
      res.status(400).json({ error: "All fields are required, including a referral code" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    // Validate BNB wallet address (basic format check)
    if (!/^0x[a-fA-F0-9]{40}$/.test(bnbWallet)) {
      res.status(400).json({ error: "Invalid BNB Smart Chain wallet address" });
      return;
    }

    // Check referral code validity
    let referredById: number | null = null;
    const isCompanyCode = referralCode.toUpperCase() === COMPANY_MASTER_CODE.toUpperCase();

    if (!isCompanyCode) {
      const [referrer] = await db
        .select({ id: nwpUsersTable.id })
        .from(nwpUsersTable)
        .where(eq(nwpUsersTable.referralCode, referralCode.toUpperCase()))
        .limit(1);

      if (!referrer) {
        res.status(400).json({ error: "Invalid referral code. Please use a valid referral link to register." });
        return;
      }
      referredById = referrer.id;
    }

    // Check email uniqueness
    const [existing] = await db
      .select({ id: nwpUsersTable.id })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate unique referral code for new user
    let newReferralCode: string;
    let codeExists = true;
    do {
      newReferralCode = nanoid(8).toUpperCase();
      const [clash] = await db
        .select({ id: nwpUsersTable.id })
        .from(nwpUsersTable)
        .where(eq(nwpUsersTable.referralCode, newReferralCode))
        .limit(1);
      codeExists = !!clash;
    } while (codeExists);

    // Insert user
    const [newUser] = await db
      .insert(nwpUsersTable)
      .values({
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        mobile: mobile.trim(),
        country: country.trim(),
        address: address.trim(),
        bnbWallet: bnbWallet.trim(),
        referralCode: newReferralCode,
        referredById,
        status: "pending_approval",
        role: "customer",
      })
      .returning();

    // Send emails (non-blocking)
    sendWelcomeEmail({ toEmail: newUser.email, fullName: newUser.fullName }).catch(console.error);
    sendNewApplicationAlert({
      fullName: newUser.fullName,
      email: newUser.email,
      mobile: newUser.mobile,
      country: newUser.country,
      address: newUser.address,
      bnbWallet: newUser.bnbWallet,
      referredByCode: referralCode.toUpperCase(),
      userId: newUser.id,
    }).catch(console.error);

    res.status(201).json({
      success: true,
      message: "Registration successful. Your application is under review.",
      userId: newUser.id,
    });
  } catch (err) {
    console.error("[NWP register]", err);
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

// ── POST /nwp/auth/login ─────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    if (user.status === "pending_approval") {
      res.status(403).json({
        error: "Your account is pending approval. You will receive an email once approved.",
        status: "pending_approval",
      });
      return;
    }

    if (user.status === "rejected") {
      res.status(403).json({
        error: "Your application was not approved. Contact support@nexuswealthpartners.group for assistance.",
        status: "rejected",
      });
      return;
    }

    if (user.status === "inactive") {
      res.status(403).json({
        error: "Your account has been deactivated. Contact support for assistance.",
        status: "inactive",
      });
      return;
    }

    const token = createCustomerToken(user.id, user.email);
    res
      .cookie(CUSTOMER_COOKIE, token, {
        ...COOKIE_OPTS,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      })
      .json({
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          mobile: user.mobile,
          country: user.country,
          address: user.address,
          bnbWallet: user.bnbWallet,
          referralCode: user.referralCode,
          status: user.status,
          package: user.package,
          investmentAmountUsd: user.investmentAmountUsd,
          investmentStartDate: user.investmentStartDate,
          createdAt: user.createdAt,
        },
      });
  } catch (err) {
    console.error("[NWP login]", err);
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

// ── GET /nwp/auth/me ─────────────────────────────────────────────────────────
router.get("/me", requireNwpAuth, async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, req.nwpUser!.id))
      .limit(1);

    if (!user) {
      res.clearCookie(CUSTOMER_COOKIE).status(401).json({ error: "User not found" });
      return;
    }

    res.json({
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobile: user.mobile,
        country: user.country,
        address: user.address,
        bnbWallet: user.bnbWallet,
        referralCode: user.referralCode,
        status: user.status,
        package: user.package,
        investmentAmountUsd: user.investmentAmountUsd,
        investmentStartDate: user.investmentStartDate,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    console.error("[NWP me]", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// ── POST /nwp/auth/logout ────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  res.clearCookie(CUSTOMER_COOKIE, { path: "/" }).json({ success: true });
});

// ── POST /nwp/auth/forgot-password ──────────────────────────────────────────
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body as { email: string };
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    // Always respond success to avoid user enumeration
    const [user] = await db
      .select({ id: nwpUsersTable.id, fullName: nwpUsersTable.fullName, email: nwpUsersTable.email })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (user) {
      // Delete any existing tokens for this user
      await db.delete(nwpPasswordResetTokensTable)
        .where(eq(nwpPasswordResetTokensTable.userId, user.id));

      // Create a new token (expires in 1 hour)
      const token = nanoid(48);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(nwpPasswordResetTokensTable).values({
        userId: user.id,
        token,
        expiresAt,
      });

      sendPasswordResetEmail({ toEmail: user.email, fullName: user.fullName, token }).catch(console.error);
    }

    res.json({ success: true, message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error("[NWP forgot-password]", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

// ── POST /nwp/auth/reset-password ───────────────────────────────────────────
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body as { token: string; password: string };

    if (!token || !password) {
      res.status(400).json({ error: "Token and new password are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const now = new Date();
    const [record] = await db
      .select()
      .from(nwpPasswordResetTokensTable)
      .where(
        and(
          eq(nwpPasswordResetTokensTable.token, token),
          gt(nwpPasswordResetTokensTable.expiresAt, now),
        )
      )
      .limit(1);

    if (!record) {
      res.status(400).json({ error: "This reset link is invalid or has expired. Please request a new one." });
      return;
    }

    // Update password
    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(nwpUsersTable)
      .set({ passwordHash })
      .where(eq(nwpUsersTable.id, record.userId));

    // Delete the used token
    await db.delete(nwpPasswordResetTokensTable)
      .where(eq(nwpPasswordResetTokensTable.id, record.id));

    res.json({ success: true, message: "Password updated successfully. You can now log in." });
  } catch (err) {
    console.error("[NWP reset-password]", err);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

export default router;
