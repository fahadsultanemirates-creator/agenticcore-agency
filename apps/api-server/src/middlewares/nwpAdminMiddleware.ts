import type { Request, Response, NextFunction } from "express";
import { verifyAdminToken, ADMIN_COOKIE } from "../lib/nwpJwt";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      isNwpAdmin?: boolean;
    }
  }
}

export function requireNwpAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token =
    req.cookies?.[ADMIN_COOKIE] ||
    req.headers["x-nwp-admin-token"];
  if (!token || typeof token !== "string") {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }
  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: "Invalid or expired admin token" });
    return;
  }
  req.isNwpAdmin = true;
  next();
}
