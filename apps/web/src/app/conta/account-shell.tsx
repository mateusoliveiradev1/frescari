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
    "inline-flex shrink-0 items-center justify-center rounded-full border px-4 py-2.5 font-sans text-[11px] font-bold uppercase tracking-[0.16em] transition-[background-color,color,border-color,box-shadow]",
    active
      ? "border-forest bg-forest text-cream shadow-[0_18px_40px_-28px_rgba(13,51,33,0.8)]"
      : "border-soil/10 bg-cream/75 text-bark hover:border-forest/30 hover:bg-sage/30 hover:text-forest",
  ].join(" ");
}

function getFirstName(userName?: string | null) {
  return userName?.trim().split(/\s+/).at(0) ?? null;
}

function formatSectionList(labels: string[]) {
  const normalizedLabels = labels.map((label) => label.toLowerCase());

  if (normalizedLabels.length <= 1) {
    return normalizedLabels.join("");
  }

  return `${normalizedLabels.slice(0, -1).join(", ")} e ${normalizedLabels.at(-1)}`;
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
  const firstName = getFirstName(userName);
  const sectionList = formatSectionList(
    sections.map((section) => section.label),
  );

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
        <header className="px-1 py-2 sm:px-2">
          <p className="font-sans text-[11px] font-bold uppercase tracking-[0.22em] text-bark/70">
            Area Frescari
          </p>
          <div className="mt-3 max-w-3xl space-y-2">
            <h1 className="font-display text-4xl font-black leading-none text-soil sm:text-5xl">
              {firstName ? `Oi, ${firstName}.` : "Sua area Frescari."}
            </h1>
            <p className="font-sans text-sm leading-6 text-bark/80 sm:text-base">
              Seu espaco para manter a Frescari do seu jeito. {sectionList}{" "}
              ficam juntos, faceis de revisar quando precisar.
            </p>
          </div>
        </header>

        <div className="grid gap-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start">
          <aside className="surface-panel rounded-[24px] p-3 lg:sticky lg:top-24">
            <nav
              aria-label="Navegacao interna de Minha Conta"
              className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
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

          <section className="surface-panel rounded-[26px] p-4 sm:p-6 lg:p-8">
            {children}
          </section>
        </div>
      </main>
    </div>
  );
}
