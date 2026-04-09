import type { Metadata } from "next";
import type { ReactNode } from "react";

import { buildNoIndexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoIndexMetadata({
  description:
    "Area de autenticacao da plataforma Frescari para login, cadastro e verificacao de email.",
  path: "/auth/login",
  title: "Acesso a plataforma | Frescari",
});

export default function AuthLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
