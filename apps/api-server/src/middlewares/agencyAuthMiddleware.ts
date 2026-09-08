import type { Request, Response, NextFunction } from "express";
import { verifyAgencyToken, AGENCY_COOKIE } from "../lib/agencyJwt";

export interface AgencyUser {
  id: number;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      agencyUser?: AgencyUser;
    }
  }
}

export function requireAgencyAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token =
    req.cookies?.[AGENCY_COOKIE] ||
    req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = verifyAgencyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.agencyUser = { id: payload.userId, email: payload.email };
  next();
}
