import type { Metadata } from "next";
import type { ReactNode } from "react";

import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  description: "Area autenticada de operacao e gestao da plataforma Frescari.",
  path: "/dashboard",
  title: "Painel do usuario | Frescari",
});

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
