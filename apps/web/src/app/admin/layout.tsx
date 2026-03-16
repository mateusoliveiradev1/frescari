import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isAdminRole } from "@/lib/role-routing";
import { getRequestAuthSession } from "@/lib/server-session";

import { AdminShell } from "./admin-shell";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
    children,
}: Readonly<{
    children: ReactNode;
}>) {
    const session = await getRequestAuthSession();

    if (!session?.user) {
        redirect("/auth/login");
    }

    if (!isAdminRole(session.user.role)) {
        redirect("/dashboard");
    }

    return <AdminShell userName={session.user.name}>{children}</AdminShell>;
}
