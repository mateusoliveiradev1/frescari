import type { ComponentType, ReactNode } from "react";
import Link from "next/link";

import {
  getAccountSectionFromPathname,
  getAccountSectionsForRole,
  type AccountRole,
} from "./account-sections";

type AccountShellViewProps = {
  children: ReactNode;
  LinkComponent?: ComponentType<AccountLinkProps>;
  pathname: string;
  role: AccountRole;
  userName?: string | null;
};

type AccountLinkProps = {
  "aria-current"?: "page";
  children: ReactNode;
  className: string;
  href: string;
};

function DefaultAccountLink(props: AccountLinkProps) {
  return <Link {...props} />;
}

function getAccountLinkClasses(active: boolean) {
  return [
    "rounded-sm border px-4 py-3 font-sans text-xs font-bold uppercase tracking-[0.18em] transition-[background-color,color,border-color]",
    active
      ? "border-forest bg-sage/40 text-forest"
      : "border-soil/10 bg-white/70 text-bark hover:border-forest/30 hover:text-forest",
  ].join(" ");
}

export function AccountShellView({
  children,
  LinkComponent = DefaultAccountLink,
  pathname,
  role,
  userName,
}: AccountShellViewProps) {
  const sections = getAccountSectionsForRole(role);
  const currentSection = getAccountSectionFromPathname(pathname);

  return (
    <div className="min-h-screen bg-cream">
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-8 px-6 py-10 lg:px-12">
        <header className="space-y-2">
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
            Minha Conta
          </p>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="space-y-1">
              <h1 className="font-display text-4xl font-black text-soil">
                Gerencie seu acesso e seus dados.
              </h1>
              <p className="max-w-3xl font-sans text-sm text-bark">
                Perfil, cadastro, seguranca e acessos principais ficam reunidos
                em uma unica superficie.
              </p>
            </div>
            {userName ? (
              <p className="font-sans text-sm font-semibold text-forest">
                Conta ativa: {userName}
              </p>
            ) : null}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-sm border border-soil/10 bg-white/60 p-4 shadow-sm">
            <nav
              aria-label="Navegacao interna de Minha Conta"
              className="flex flex-col gap-3"
            >
              {sections.map((section) => {
                const isActive = currentSection === section.key;

                return (
                  <LinkComponent
                    aria-current={isActive ? "page" : undefined}
                    className={getAccountLinkClasses(isActive)}
                    href={section.href}
                    key={section.key}
                  >
                    {section.label}
                  </LinkComponent>
                );
              })}
            </nav>
          </aside>

          <section className="rounded-sm border border-soil/10 bg-white/80 p-6 shadow-sm">
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
