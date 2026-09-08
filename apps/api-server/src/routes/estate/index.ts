import { Router } from "express";
import authRouter from "./auth";
import citiesRouter from "./cities";
import propertiesRouter from "./properties";
import agentsRouter from "./agents";
import developersRouter from "./developers";
import projectsRouter from "./projects";
import adminRouter from "./admin";
import aiChatRouter from "./aiChat";

const router = Router();

router.use("/auth", authRouter);
router.use("/cities", citiesRouter);
router.use("/properties", propertiesRouter);
router.use("/agents", agentsRouter);
router.use("/developers", developersRouter);
router.use("/projects", projectsRouter);
router.use("/admin", adminRouter);
router.use("/ai", aiChatRouter);

export default router;
