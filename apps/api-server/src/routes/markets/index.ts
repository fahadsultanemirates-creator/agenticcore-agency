import { Router } from "express";
import authRouter from "./auth";
import customerRouter from "./customer";
import adminRouter from "./admin";
import aiChatRouter from "./aiChat";
import futuresRouter from "./futures";

const router = Router();

router.use("/auth", authRouter);
router.use("/admin", adminRouter);
router.use("/ai", aiChatRouter);
router.use("/", futuresRouter);
router.use("/", customerRouter);

export default router;
