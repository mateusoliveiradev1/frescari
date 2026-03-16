import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/role-routing";

import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/auth/login");
    }

    if (!isAdminRole(session.user.role)) {
        redirect("/dashboard");
    }

    return <AdminShell userName={session.user.name}>{children}</AdminShell>;
}
