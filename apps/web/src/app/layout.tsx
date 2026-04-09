import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";
import { Toaster } from "sonner";

import { GlobalNav } from "@/components/global-nav";
import { sanitizeEnvValue } from "@/lib/env";
import {
  buildSeoMetadata,
  SITE_DEFAULT_DESCRIPTION,
  SITE_DEFAULT_TITLE,
} from "@/lib/seo";
import { TRPCProvider } from "@/trpc/Provider";

import "./globals.css";

const playfairDisplay = Playfair_Display({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "900"],
});

const dmSans = DM_Sans({
  display: "swap",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

const googleSiteVerification = sanitizeEnvValue(
  process.env.GOOGLE_SITE_VERIFICATION,
);

const baseMetadata = buildSeoMetadata({
  description: SITE_DEFAULT_DESCRIPTION,
  path: "/",
  title: SITE_DEFAULT_TITLE,
});

export const metadata: Metadata = {
  ...baseMetadata,
  appleWebApp: {
    title: "Frescari",
  },
  icons: {
    apple: [{ sizes: "180x180", type: "image/png", url: "/apple-icon" }],
    icon: [{ sizes: "64x64", type: "image/png", url: "/icon" }],
    shortcut: [{ sizes: "64x64", type: "image/png", url: "/icon" }],
  },
  verification: googleSiteVerification
    ? {
        google: googleSiteVerification,
      }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="pt-BR">
      <body
        className={`${playfairDisplay.variable} ${dmSans.variable} antialiased`}
      >
        <TRPCProvider>
          <a className="skip-link" href="#conteudo-principal">
            Pular para o conteudo principal
          </a>
          <GlobalNav />
          <div id="conteudo-principal" tabIndex={-1}>
            {children}
          </div>
          <Toaster closeButton position="top-right" richColors />
        </TRPCProvider>
      </body>
    </html>
  );
}
