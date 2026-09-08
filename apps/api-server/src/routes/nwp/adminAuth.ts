import { Router } from "express";
import { createAdminToken, ADMIN_COOKIE, COOKIE_OPTS } from "../../lib/nwpJwt";
import { requireNwpAdmin } from "../../middlewares/nwpAdminMiddleware";

const router = Router();

const ADMIN_EMAIL = process.env.NWP_ADMIN_EMAIL || "nexuswealthpartner@gmail.com";

// ── POST /nwp/admin/login ────────────────────────────────────────────────────
router.post("/login", (req, res) => {
  const { email, password } = req.body as { email: string; password: string };

  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }

  const adminPassword = process.env.NWP_ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error("[NWP Admin] NWP_ADMIN_PASSWORD env var is not set");
    res.status(503).json({ error: "Admin authentication is not configured. Set NWP_ADMIN_PASSWORD." });
    return;
  }

  if (
    email.toLowerCase() !== ADMIN_EMAIL.toLowerCase() ||
    password !== adminPassword
  ) {
    res.status(401).json({ error: "Invalid admin credentials" });
    return;
  }

  const token = createAdminToken();
  res
    .cookie(ADMIN_COOKIE, token, {
      ...COOKIE_OPTS,
      maxAge: 12 * 60 * 60 * 1000,
    })
    .json({ success: true, email: ADMIN_EMAIL });
});

// ── POST /nwp/admin/logout ───────────────────────────────────────────────────
router.post("/logout", requireNwpAdmin, (req, res) => {
  res.clearCookie(ADMIN_COOKIE, { path: "/" }).json({ success: true });
});

// ── GET /nwp/admin/me ────────────────────────────────────────────────────────
router.get("/me", requireNwpAdmin, (req, res) => {
  res.json({ authenticated: true, email: ADMIN_EMAIL });
});

export default router;
