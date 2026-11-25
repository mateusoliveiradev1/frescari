import type { Metadata } from "next";
import type { ReactNode } from "react";

import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  description: "Área autenticada de operação e gestão da plataforma Frescari.",
  path: "/dashboard",
  title: "Painel do usuário | Frescari",
});

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
