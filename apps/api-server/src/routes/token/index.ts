import { Router } from "express";
import authRouter    from "./auth";
import presaleRouter from "./presale";
import referralRouter from "./referral";
import statsRouter   from "./stats";
import adminRouter   from "./admin";

const router = Router();

router.use("/auth",     authRouter);
router.use("/presale",  presaleRouter);
router.use("/referral", referralRouter);
router.use("/stats",    statsRouter);
router.use("/admin",    adminRouter);

export default router;
