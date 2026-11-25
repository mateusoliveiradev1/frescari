import type { Metadata } from "next";
import type { ReactNode } from "react";

import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  description:
    "Área de autenticação da plataforma Frescari para login, cadastro e verificação de email.",
  path: "/auth/login",
  title: "Acesso à plataforma | Frescari",
});

export default function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
