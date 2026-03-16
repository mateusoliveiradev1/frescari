"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@frescari/ui";

type AdminShellProps = {
    children: ReactNode;
    userName?: string | null;
};

const navItems = [
    { exact: true, href: "/admin", label: "Visao geral" },
    { href: "/admin/catalogo", label: "Catalogo" },
    { href: "/admin/usuarios", label: "Usuarios" },
];

function isActivePath(pathname: string, href: string, exact = false) {
    if (exact) {
        return pathname === href;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminShell({ children, userName }: AdminShellProps) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen bg-cream">
            <main className="mx-auto max-w-[1400px] px-6 py-10 lg:px-12">
                <div className="space-y-8">
                    <section className="surface-panel rounded-[32px] px-6 py-6 sm:px-8">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                            <div className="space-y-2">
                                <p className="font-sans text-[10px] font-bold uppercase tracking-[0.2em] text-bark/70">
                                    Area administrativa
                                </p>
                                <h1 className="font-display text-4xl font-black tracking-[-0.05em] text-soil sm:text-5xl">
                                    Operacao da plataforma
                                </h1>
                                <p className="max-w-2xl font-sans text-sm leading-6 text-bark/76">
                                    {userName ? `${userName}, ` : ""}
                                    esta area fica fora do dashboard de tenant e concentra controles
                                    de plataforma, governanca e operacao administrativa.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">role admin</Badge>
                                <Badge variant="secondary">plataforma</Badge>
                            </div>
                        </div>

                        <nav className="mt-6 flex flex-wrap gap-3">
                            {navItems.map((item) => {
                                const active = isActivePath(pathname, item.href, item.exact);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={[
                                            "rounded-full px-4 py-2 font-sans text-[11px] font-bold uppercase tracking-[0.16em]",
                                            "transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 focus-visible:ring-offset-cream",
                                            active
                                                ? "bg-forest text-cream"
                                                : "bg-white text-bark hover:bg-sage/35 hover:text-forest",
                                        ].join(" ")}
                                    >
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </nav>
                    </section>

                    {children}
                </div>
            </main>
        </div>
    );
}
