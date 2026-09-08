import type { Request, Response, NextFunction } from "express";
import { verifyCustomerToken, CUSTOMER_COOKIE } from "../lib/nwpJwt";

export interface NwpUser {
  id: number;
  email: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      nwpUser?: NwpUser;
    }
  }
}

export function requireNwpAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token =
    req.cookies?.[CUSTOMER_COOKIE] ||
    req.headers.authorization?.replace(/^Bearer /, "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const payload = verifyCustomerToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  req.nwpUser = { id: payload.userId, email: payload.email };
  next();
}
