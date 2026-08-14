import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { CanonicalHostRedirect } from "@/components/pwa/CanonicalHostRedirect";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { PRODUCTION_ORIGIN } from "@/lib/site";
import "./globals.css";

const sans = Sora({
  variable: "--font-numa-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

const mono = JetBrains_Mono({
  variable: "--font-numa-mono",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  title: "NUMA",
  description: "Din dagsbudget — se vad som är kvar idag, planera och håll koll på saldot.",
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
  // Allow pinch-zoom; inputs use 16px so iOS won't auto-zoom on focus.
  viewportFit: "cover",
  themeColor: "#e4efe8",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sv" className={`${sans.variable} ${mono.variable} h-full`}>
      <body className="min-h-full antialiased">
        <CanonicalHostRedirect />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
