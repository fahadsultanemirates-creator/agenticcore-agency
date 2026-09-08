import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { authMiddleware } from "./middlewares/authMiddleware";
import path from "path";
import fs from "fs";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Temporary forex download route (before auth middleware so it's public)
app.get("/api/download/forex", (_req, res) => {
  const zipPath = path.join(process.cwd(), "..", "..", "forex.zip");
  if (!fs.existsSync(zipPath)) {
    res.status(404).send("File not found.");
    return;
  }
  res.download(zipPath, "agenticcore-forex.zip");
});

// The artifact router probes the API mount point during publishing. Keep this
// lightweight and unauthenticated; the detailed service health path remains
// /api/healthz in artifact.toml.
app.get("/api", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(authMiddleware);
app.use("/api", router);

export default app;
