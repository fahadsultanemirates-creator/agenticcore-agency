import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import referralsRouter from "./referrals";
import nwpRouter from "./nwp";
import forexRouter from "./forex";
import premiumForexRouter from "./premiumForex";
import agencyRouter from "./agency";
import marketsRouter from "./markets";
import estateRouter from "./estate";
import tokenRouter from "./token";
import nexusTelegramRouter from "./nexusTelegram";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(referralsRouter);
router.use("/nwp", nwpRouter);
router.use("/forex", forexRouter);
router.use("/premium-forex", premiumForexRouter);
router.use("/agency", agencyRouter);
router.use("/markets", marketsRouter);
router.use("/estate", estateRouter);
router.use("/token", tokenRouter);
router.use(nexusTelegramRouter); // Nexus Manager Telegram webhook — accessible at /api/telegram-webhook

export default router;
