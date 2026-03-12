import type { Metadata } from "next";
import { Playfair_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import { TRPCProvider } from "@/trpc/Provider";
import { GlobalNav } from "@/components/global-nav";

const playfairDisplay = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Frescari — Hortifruti Direto da Horta",
  description:
    "Produtos colhidos hoje em fazendas a menos de 50km de você. Apoie o produtor local e garanta o máximo de frescor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${playfairDisplay.variable} ${dmSans.variable} antialiased`}
      >
        <TRPCProvider>
          <GlobalNav />
          {children}
        </TRPCProvider>
      </body>
    </html>
  );
}
