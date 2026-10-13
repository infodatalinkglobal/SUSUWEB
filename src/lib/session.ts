import { getIronSession, type IronSession, type SessionOptions } from "iron-session";
import { cookies, headers } from "next/headers";

export interface SessionData {
  userId?: string;
  phone?: string;
  displayName?: string;
  isDemo?: boolean;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

export function isDemoPreviewEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.AUTH_DEMO_MODE === "true" &&
    process.env.NEXT_PUBLIC_AUTH_DEMO_MODE === "true"
  );
}

function isPreviewHost(value: string | null): boolean {
  if (!value) return false;

  try {
    const firstValue = value.split(",")[0]?.trim();
    if (!firstValue) return false;
    const url = firstValue.includes("://")
      ? new URL(firstValue)
      : new URL(`http://${firstValue}`);
    return url.hostname.endsWith(".e2b.app");
  } catch {
    return false;
  }
}

async function getSessionOptions(): Promise<SessionOptions> {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  const isPreviewRequest =
    isPreviewHost(origin) ||
    isPreviewHost(requestHeaders.get("x-forwarded-host")) ||
    isPreviewHost(requestHeaders.get("host"));
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const isSecureRequest =
    process.env.NODE_ENV === "production" ||
    isPreviewRequest ||
    forwardedProtocol === "https" ||
    origin?.startsWith("https://") === true;

  return {
    cookieName: "susuapp_session",
    password,
    cookieOptions: {
      httpOnly: true,
      secure: isSecureRequest,
      sameSite: isPreviewRequest ? "none" : "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 14,
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), await getSessionOptions());
}

export async function requireAuth(): Promise<{ userId: string; phone: string }> {
  const session = await getSession();
  if (!session.userId || !session.phone || session.isDemo) {
    throw new UnauthorizedError();
  }

  return { userId: session.userId, phone: session.phone };
}
