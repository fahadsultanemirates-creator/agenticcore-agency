import { Router } from "express";
import authRouter from "./auth";
import tasksRouter from "./tasks";
import creditsRouter from "./credits";
import customerRouter from "./customer";
import adminRouter from "./admin";
import aiChatRouter from "./aiChat";

const router = Router();

router.use("/auth", authRouter);
router.use("/", customerRouter); // handles /me and /stats
router.use("/tasks", tasksRouter);
router.use("/credits", creditsRouter);
router.use("/admin", adminRouter);
router.use("/ai", aiChatRouter);

export default router;
