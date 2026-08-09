import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { AppShell } from "@/components/layout/AppShell";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-numa-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-numa-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "NUMA",
  description: "Personlig ekonomisk kontroll — saldo, plan och tryggt att spendera.",
  applicationName: "NUMA",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "NUMA",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef2ef" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1411" },
  ],
};

// Local store + financial state must always render from current data.
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full antialiased">
        <AppShell>{children}</AppShell>
        <PwaRegister />
      </body>
    </html>
  );
}
