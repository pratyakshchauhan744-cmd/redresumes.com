import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { UserRole } from "@prisma/client";

// Define fallback in case roles are not yet migrated in the Prisma schema
export type AdminRole = "admin" | "manager" | "support";

export interface SessionPayload {
  userId: string;
  email: string;
  role: UserRole;
  createdAt: number;
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET
);
const SESSION_COOKIE_NAME = "redresumes_admin_session";

/**
 * Sign a JWT token for the user session
 */
export async function signSessionToken(payload: Omit<SessionPayload, "createdAt">): Promise<string> {
  const finalPayload: SessionPayload = {
    ...payload,
    createdAt: Date.now(),
  };

  return new SignJWT({ ...finalPayload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h") // Session valid for 8 hours
    .sign(JWT_SECRET);
}

/**
 * Verify and decode the JWT session token
 */
export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch (error) {
    console.error("JWT validation error:", error);
    return null;
  }
}

/**
 * Extract user session from request cookies (Server Components / Server Actions)
 */
export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch (error) {
    console.error("Failed to read session cookie:", error);
    return null;
  }
}

/**
 * Set session cookie on the response headers
 */
export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
}

/**
 * Clear session cookie (Logout)
 */
export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    maxAge: 0,
    path: "/",
  });
}

/**
 * Role checking helper to verify if a user has sufficient privileges
 */
export function hasRequiredRole(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Server-side guard utility. Throws an error or redirects if unauthorized.
 * Used at the top of Server Actions and Server Components.
 */
export async function ensureAuthorized(allowedRoles: UserRole[]): Promise<SessionPayload> {
  const session = await getSession();

  if (!session) {
    throw new Error("UNAUTHENTICATED");
  }

  if (!hasRequiredRole(session.role, allowedRoles)) {
    throw new Error("UNAUTHORIZED");
  }

  return session;
}
