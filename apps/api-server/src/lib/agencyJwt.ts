import jwt from "jsonwebtoken";

const _rawSecret = process.env.AGENCY_JWT_SECRET;

if (!_rawSecret) {
  if (process.env.NODE_ENV === "production") {
    // Hard fail: token forgery is a critical risk without a real secret.
    throw new Error(
      "[Agency] AGENCY_JWT_SECRET must be set in production. " +
        "Add it to Replit Secrets (the padlock icon in the sidebar).",
    );
  }
  console.warn(
    "[Agency] AGENCY_JWT_SECRET is not set — using an insecure fallback. " +
      "Set AGENCY_JWT_SECRET in Replit Secrets before deploying to production.",
  );
}

const JWT_SECRET =
  _rawSecret || "agency-dev-fallback-CHANGE-BEFORE-PRODUCTION";

export interface AgencyCustomerPayload {
  userId: number;
  email: string;
  type: "agency-customer";
}

export function createAgencyToken(userId: number, email: string): string {
  return jwt.sign(
    { userId, email, type: "agency-customer" } satisfies AgencyCustomerPayload,
    JWT_SECRET,
    { expiresIn: "30d" },
  );
}

export function verifyAgencyToken(
  token: string,
): AgencyCustomerPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AgencyCustomerPayload;
    if (payload.type !== "agency-customer") return null;
    return payload;
  } catch {
    return null;
  }
}

export const AGENCY_COOKIE = "agency_token";

export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
