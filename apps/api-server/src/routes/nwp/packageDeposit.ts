import { Router } from "express";
import { db } from "@workspace/db";
import { nwpUsersTable, nwpDepositsTable } from "@workspace/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { requireNwpAuth } from "../../middlewares/nwpAuthMiddleware";
import { PACKAGE_RANGES } from "../../lib/financialEngine";
import { sendDepositDetectedEmails, sendBonusCodeDepositAlert } from "../../lib/emailService";

const MASTER_CODE = process.env.NWP_MASTER_CODE ?? "";

const router = Router();
router.use(requireNwpAuth);

const DEPOSIT_WALLET = process.env.NWP_DEPOSIT_WALLET || "0x62Ad7D55fbc8A8591109D72b67Ec63aa1EE196bC";

// ── POST /nwp/package-selection ───────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;
    const { package: pkg, amountUsd } = req.body as {
      package: string;
      amountUsd: string | number;
    };

    if (!pkg || !amountUsd) {
      res.status(400).json({ error: "package and amountUsd are required" });
      return;
    }

    const amount = typeof amountUsd === "string" ? parseFloat(amountUsd) : amountUsd;
    if (isNaN(amount) || amount <= 0) {
      res.status(400).json({ error: "Invalid investment amount" });
      return;
    }

    const range = PACKAGE_RANGES[pkg];
    if (!range) {
      res.status(400).json({ error: "Invalid package selected" });
      return;
    }

    const [min, max] = range;
    if (amount < min || amount > max) {
      res.status(400).json({
        error: `Amount $${amount} is outside the ${pkg} package range ($${min}–${max === Infinity ? "∞" : "$" + max})`,
      });
      return;
    }

    // Fetch user to check status
    const [user] = await db
      .select({ status: nwpUsersTable.status, package: nwpUsersTable.package })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.status !== "approved_inactive") {
      res.status(403).json({
        error: "Package selection is only available for approved accounts awaiting deposit",
      });
      return;
    }

    // Save package selection on user record
    await db.update(nwpUsersTable).set({
      package: pkg as typeof nwpUsersTable.$inferSelect["package"],
      investmentAmountUsd: amount.toFixed(2),
      updatedAt: new Date(),
    }).where(eq(nwpUsersTable.id, userId));

    // Check for bypass code
    const { bypassCode } = req.body as { bypassCode?: string };
    const isBypass = MASTER_CODE && bypassCode && bypassCode.trim() === MASTER_CODE;

    // Create/update deposit record (clear any previous awaiting/bypass)
    await db.delete(nwpDepositsTable).where(
      and(
        eq(nwpDepositsTable.userId, userId),
        eq(nwpDepositsTable.status, "awaiting"),
      ),
    );
    await db.delete(nwpDepositsTable).where(
      and(
        eq(nwpDepositsTable.userId, userId),
        eq(nwpDepositsTable.status, "bypass"),
      ),
    );

    const depositStatus = isBypass ? "bypass" : "awaiting";

    const [deposit] = await db.insert(nwpDepositsTable).values({
      userId,
      amountUsd: amount.toFixed(2),
      package: pkg as typeof nwpDepositsTable.$inferSelect["package"],
      status: depositStatus,
      bypassCodeUsed: !!isBypass,
    }).returning();

    if (isBypass) {
      // Notify admin about bonus code deposit (dedicated email — no blockchain wait)
      const [user] = await db
        .select({ email: nwpUsersTable.email, fullName: nwpUsersTable.fullName })
        .from(nwpUsersTable)
        .where(eq(nwpUsersTable.id, userId))
        .limit(1);
      if (user) {
        sendBonusCodeDepositAlert({
          user: { email: user.email, fullName: user.fullName },
          deposit: { amountUsd: amount.toFixed(2), package: pkg },
        }).catch(() => {});
      }
    }

    res.json({
      success: true,
      bypass: !!isBypass,
      deposit: {
        id: deposit.id,
        amountUsd: deposit.amountUsd,
        package: deposit.package,
        status: deposit.status,
      },
      depositInstructions: isBypass ? null : {
        walletAddress: DEPOSIT_WALLET,
        network: "BNB Smart Chain (BEP-20)",
        token: "USDT",
        amountUsd: amount.toFixed(2),
        note: "Send exactly this amount. Your account will be activated within 24 hours after deposit verification.",
      },
      bypassMessage: isBypass
        ? "Bypass code accepted. Your account is pending admin activation."
        : null,
    });
  } catch (err) {
    console.error("[NWP package selection]", err);
    res.status(500).json({ error: "Failed to process package selection" });
  }
});

// ── GET /nwp/package-selection ────────────────────────────────────────────────
// Returns current deposit instructions if package already selected
router.get("/", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const [user] = await db
      .select({
        status: nwpUsersTable.status,
        package: nwpUsersTable.package,
        investmentAmountUsd: nwpUsersTable.investmentAmountUsd,
      })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user?.package || !user.investmentAmountUsd) {
      res.json({ packageSelected: false });
      return;
    }

    // Query for the most recent pending deposit (awaiting or detected)
    const [deposit] = await db
      .select({
        id: nwpDepositsTable.id,
        status: nwpDepositsTable.status,
      })
      .from(nwpDepositsTable)
      .where(
        and(
          eq(nwpDepositsTable.userId, userId),
          inArray(nwpDepositsTable.status, ["awaiting", "detected"]),
        ),
      )
      .orderBy(desc(nwpDepositsTable.createdAt))
      .limit(1);

    res.json({
      packageSelected: true,
      package: user.package,
      amountUsd: user.investmentAmountUsd,
      depositStatus: deposit?.status ?? "awaiting",
      depositInstructions: {
        walletAddress: DEPOSIT_WALLET,
        network: "BNB Smart Chain (BEP-20)",
        token: "USDT",
        amountUsd: user.investmentAmountUsd,
        note: "Send exactly this amount. Your account will be activated within 24 hours after deposit verification.",
      },
    });
  } catch (err) {
    console.error("[NWP deposit status]", err);
    res.status(500).json({ error: "Failed to fetch deposit status" });
  }
});

// ── POST /nwp/package-selection/notify ───────────────────────────────────────
// Client presses "I've sent my deposit" — alerts admin by email
router.post("/notify", async (req, res) => {
  try {
    const userId = req.nwpUser!.id;

    const [user] = await db
      .select({
        email: nwpUsersTable.email,
        fullName: nwpUsersTable.fullName,
        package: nwpUsersTable.package,
        investmentAmountUsd: nwpUsersTable.investmentAmountUsd,
      })
      .from(nwpUsersTable)
      .where(eq(nwpUsersTable.id, userId))
      .limit(1);

    if (!user || !user.package || !user.investmentAmountUsd) {
      res.status(400).json({ error: "No active deposit request found" });
      return;
    }

    // Send admin notification email
    const { sendDepositNotifyEmail } = await import("../../lib/emailService");
    await sendDepositNotifyEmail({
      fullName: user.fullName,
      email: user.email,
      amountUsd: user.investmentAmountUsd,
      pkg: user.package,
    });

    res.json({ success: true });
  } catch (err) {
    console.error("[NWP deposit notify]", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
});

export default router;
