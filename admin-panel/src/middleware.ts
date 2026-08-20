import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE_NAME = "redresumes_admin_session";
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET
);

// Paths that do not require authentication
const PUBLIC_PATHS = ["/login", "/api/health"];

// Allow staff roles
const ALLOWED_STAFF_ROLES = ["admin", "manager", "support"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip middleware for static assets, public paths, and health checks
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname.includes(".") ||
    PUBLIC_PATHS.some((path) => pathname.startsWith(path))
  ) {
    return NextResponse.next();
  }

  // 2. Fetch the session cookie
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    // Redirect to login if accessing protected admin area
    if (pathname.startsWith("/admin")) {
      const loginUrl = new URL("/login", request.url);
      // Pass original destination to redirect back after successful login
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  try {
    // 3. Verify JWT
    const { payload } = await jwtVerify(sessionCookie, JWT_SECRET, {
      algorithms: ["HS256"],
    });

    const userRole = payload.role as string;

    // 4. Role-based Route Guard
    if (pathname.startsWith("/admin")) {
      // Check if user is staff
      if (!ALLOWED_STAFF_ROLES.includes(userRole)) {
        // Logged-in candidates/employers cannot view admin
        return NextResponse.redirect(new URL("/admin/forbidden", request.url));
      }

      // Check granular route permissions
      // Support role can only access: /admin, /admin/users, /admin/users/[id], /admin/logs
      if (userRole === "support") {
        const allowedSupportPaths = [
          "/admin",
          "/admin/users",
          "/admin/logs"
        ];

        const isPathAllowed = allowedSupportPaths.some(p =>
          pathname === p || pathname.startsWith(p + "/")
        );

        // Support cannot visit purchases, credits, roles, or settings
        if (!isPathAllowed) {
          return NextResponse.redirect(new URL("/admin/forbidden", request.url));
        }
      }

      // Manager can access: everything except settings and roles
      if (userRole === "manager") {
        const restrictedPaths = ["/admin/roles", "/admin/settings"];
        if (restrictedPaths.some(p => pathname.startsWith(p))) {
          return NextResponse.redirect(new URL("/admin/forbidden", request.url));
        }
      }
    }

    // Authenticated and authorized - proceed
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware Auth Verification Error:", error);
    // Invalid or expired token - clear cookie and redirect to login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete(SESSION_COOKIE_NAME);
    return response;
  }
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
