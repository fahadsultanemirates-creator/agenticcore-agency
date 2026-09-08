import { Router, type Request, type Response } from "express";
import authRouter from "./auth";
import adminAuthRouter from "./adminAuth";
import adminUsersRouter from "./adminUsers";
import adminProfileRequestsRouter from "./adminProfileRequests";
import adminWithdrawalsRouter from "./adminWithdrawals";
import adminDepositsRouter from "./adminDeposits";
import customerProfileRouter from "./customerProfile";
import dashboardRouter from "./dashboard";
import packageDepositRouter from "./packageDeposit";
import withdrawalsRouter from "./withdrawals";
import referralTreeRouter from "./referralTree";
import aiChatRouter from "./aiChat";
import { getTelegramBot } from "../../lib/telegramBot";

const router = Router();

// Telegram webhook — Telegram POSTs updates here; no auth needed
router.post("/telegram/webhook", (req: Request, res: Response) => {
  const bot = getTelegramBot();
  if (bot) {
    bot.processUpdate(req.body);
  }
  res.sendStatus(200);
});

// Customer auth
router.use("/auth", authRouter);

// Admin auth
router.use("/admin/auth", adminAuthRouter);

// Admin management
router.use("/admin/users", adminUsersRouter);
router.use("/admin/profile-requests", adminProfileRequestsRouter);
router.use("/admin/withdrawals", adminWithdrawalsRouter);
router.use("/admin/deposits", adminDepositsRouter);

// Customer self-service
router.use("/profile-requests", customerProfileRouter);
router.use("/dashboard", dashboardRouter);
router.use("/package-selection", packageDepositRouter);
router.use("/withdrawals", withdrawalsRouter);
router.use("/referral-tree", referralTreeRouter);

// AI support (public — no auth required)
router.use("/ai", aiChatRouter);

export default router;
