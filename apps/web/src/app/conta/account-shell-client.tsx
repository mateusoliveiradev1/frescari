"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { AccountShellView } from "./account-shell";
import type { AccountRole } from "./account-sections";

type AccountShellClientProps = {
  children: ReactNode;
  role: AccountRole;
  userName?: string | null;
};

export function AccountShellClient({
  children,
  role,
  userName,
}: AccountShellClientProps) {
  const pathname = usePathname();

  return (
    <AccountShellView pathname={pathname} role={role} userName={userName}>
      {children}
    </AccountShellView>
  );
}
