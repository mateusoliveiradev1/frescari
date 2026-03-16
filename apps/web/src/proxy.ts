import { NextRequest, NextResponse } from "next/server";
import { isAdminRole } from "./lib/role-routing";

/**
 * Auth Guard Middleware
 * Redirects authenticated users with no tenantId to /onboarding.
 * Uses Better Auth session cookie to read user data server-side.
 */
export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Skip middleware for these paths
    if (
        pathname.startsWith("/auth") ||
        pathname.startsWith("/api") ||
        pathname.startsWith("/_next") ||
        pathname.startsWith("/favicon") ||
        pathname.includes(".")
    ) {
        return NextResponse.next();
    }

    // Read the session cookie (Better Auth stores session as a cookie)
    const sessionCookie = request.cookies.get("better-auth.session_token");
    if (!sessionCookie?.value) {
        // Not authenticated — let them through (public pages)
        return NextResponse.next();
    }

    // Fetch the session from Better Auth API to get user data with tenantId
    try {
        const sessionRes = await fetch(
            new URL("/api/auth/get-session", request.url),
            {
                headers: {
                    cookie: request.headers.get("cookie") || "",
                },
            }
        );

        if (!sessionRes.ok) {
            return NextResponse.next();
        }

        const session = await sessionRes.json();

        if (!session?.user) {
            return NextResponse.next();
        }

        const role = typeof session.user.role === "string" ? session.user.role : null;
        const admin = isAdminRole(role);
        const isAdminPath = pathname === "/admin" || pathname.startsWith("/admin/");
        const isDashboardPath =
            pathname === "/dashboard" || pathname.startsWith("/dashboard/");
        const isLegacyAdminPath =
            pathname === "/dashboard/admin" || pathname.startsWith("/dashboard/admin/");

        if (admin) {
            if (pathname === "/onboarding") {
                return NextResponse.redirect(new URL("/admin", request.url));
            }

            if (isLegacyAdminPath) {
                return NextResponse.redirect(new URL("/admin/catalogo", request.url));
            }

            if (isDashboardPath) {
                return NextResponse.redirect(new URL("/admin", request.url));
            }

            return NextResponse.next();
        }

        if (isAdminPath) {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }

        // If user is authenticated but has no tenantId, redirect to onboarding
        if (!session.user.tenantId) {
            return NextResponse.redirect(new URL("/onboarding", request.url));
        }
    } catch {
        // If session fetch fails, let the request through
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        /*
         * Match all request paths except:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon)
         */
        "/((?!_next/static|_next/image|favicon.ico).*)",
    ],
};
