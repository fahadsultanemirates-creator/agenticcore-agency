import { Router, Request, Response } from "express";
import { pool } from "@workspace/db";
import { ethers } from "ethers";
import crypto from "crypto";

const router = Router();

// In-memory nonce store (per address, expires in 5 min)
const nonces = new Map<string, { nonce: string; expires: number }>();

// GET /api/token/auth/nonce?address=0x...
router.get("/nonce", (req: Request, res: Response) => {
  const address = (req.query.address as string)?.toLowerCase();
  if (!address || !/^0x[0-9a-f]{40}$/.test(address)) {
    return res.status(400).json({ error: "Invalid address" });
  }
  const nonce = crypto.randomBytes(16).toString("hex");
  nonces.set(address, { nonce, expires: Date.now() + 5 * 60 * 1000 });
  res.json({ nonce });
});

// POST /api/token/auth/connect
router.post("/connect", async (req: Request, res: Response) => {
  try {
    const { address, signature, referralCode } = req.body;
    if (!address || !signature) {
      return res.status(400).json({ error: "address and signature required" });
    }
    const normalAddress = address.toLowerCase();
    const stored = nonces.get(normalAddress);
    if (!stored || Date.now() > stored.expires) {
      return res.status(401).json({ error: "Nonce expired. Request a new one." });
    }
    nonces.delete(normalAddress);

    // Verify signature
    const recovered = ethers.verifyMessage(stored.nonce, signature).toLowerCase();
    if (recovered !== normalAddress) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    const newRefCode = crypto.randomBytes(6).toString("hex");
    await pool.query(`
      INSERT INTO ac_wallet_users (address, referral_code, referred_by)
      VALUES ($1, $2, $3)
      ON CONFLICT (address) DO UPDATE SET last_seen = NOW()
    `, [normalAddress, newRefCode, referralCode || null]);

    const { rows } = await pool.query(
      "SELECT address, referral_code, referred_by, created_at FROM ac_wallet_users WHERE address = $1",
      [normalAddress]
    );

    (req.session as any).tokenWallet = normalAddress;
    res.json({ ok: true, address: normalAddress, referralCode: rows[0]?.referral_code });
  } catch (err: any) {
    console.error("Token auth error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/token/auth/me
router.get("/me", async (req: Request, res: Response) => {
  const address = (req.session as any)?.tokenWallet;
  if (!address) return res.status(401).json({ error: "Not authenticated" });

  try {
    const { rows } = await pool.query(
      "SELECT address, referral_code, referred_by, created_at, last_seen FROM ac_wallet_users WHERE address = $1",
      [address]
    );
    if (!rows.length) return res.status(404).json({ error: "User not found" });
    res.json(rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/token/auth/logout
router.post("/logout", (req: Request, res: Response) => {
  (req.session as any).tokenWallet = null;
  req.session.destroy(() => {});
  res.json({ ok: true });
});

export default router;
