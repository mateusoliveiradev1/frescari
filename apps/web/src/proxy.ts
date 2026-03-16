import { NextRequest, NextResponse } from "next/server";

/**
 * Keep the proxy cheap.
 *
 * Session lookups here add an extra round-trip to every authenticated request,
 * which hurts navigation across the whole app. Auth and onboarding guards now
 * run inside the server-rendered routes that already load session data.
 */
export function proxy(request: NextRequest) {
    return NextResponse.redirect(new URL("/admin/catalogo", request.url));
}

export const config = {
    matcher: ["/dashboard/admin/:path*"],
};
