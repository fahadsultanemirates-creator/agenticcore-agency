import jwt from "jsonwebtoken";

const JWT_SECRET =
  process.env.NWP_JWT_SECRET ||
  "nwp-dev-fallback-secret-replace-in-production-immediately";

export interface NwpCustomerPayload {
  userId: number;
  email: string;
  type: "customer";
}

export interface NwpAdminPayload {
  type: "admin";
}

export function createCustomerToken(
  userId: number,
  email: string,
): string {
  return jwt.sign(
    { userId, email, type: "customer" } satisfies NwpCustomerPayload,
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

export function createAdminToken(): string {
  return jwt.sign({ type: "admin" } satisfies NwpAdminPayload, JWT_SECRET, {
    expiresIn: "12h",
  });
}

export function verifyCustomerToken(token: string): NwpCustomerPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as NwpCustomerPayload;
    if (payload.type !== "customer") return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyAdminToken(token: string): boolean {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as NwpAdminPayload;
    return payload.type === "admin";
  } catch {
    return false;
  }
}

export const CUSTOMER_COOKIE = "nwp_token";
export const ADMIN_COOKIE = "nwp_admin_token";

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
