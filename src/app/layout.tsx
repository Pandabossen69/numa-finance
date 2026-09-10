import type { Metadata, Viewport } from "next";
import { Sora, JetBrains_Mono } from "next/font/google";
import { CanonicalHostRedirect } from "@/components/pwa/CanonicalHostRedirect";
import { FrozenHomescreenGuard } from "@/components/pwa/FrozenHomescreenGuard";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import {
  BRAND_APPLE_TOUCH,
  BRAND_FAVICON,
  BRAND_ICON_192,
  BRAND_ICON_512,
} from "@/lib/brand-assets";
import { PRODUCTION_ORIGIN } from "@/lib/site";
import "./globals.css";

const sans = Sora({
  variable: "--font-numa-sans",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: true,
});

const mono = JetBrains_Mono({
  variable: "--font-numa-mono",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(PRODUCTION_ORIGIN),
  title: "NUMA",
  description: "Din dagsbudget — se vad som är kvar idag, planera och håll koll på saldot.",
  applicationName: "NUMA",
  icons: {
    icon: [
      { url: BRAND_FAVICON, sizes: "48x48" },
      { url: BRAND_ICON_192, sizes: "192x192", type: "image/png" },
      { url: BRAND_ICON_512, sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: BRAND_APPLE_TOUCH, sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    // Translucent so the dark NUMA shell covers the notch in Safari and PWA.
    statusBarStyle: "black-translucent",
    title: "NUMA",
  },
  openGraph: {
    title: "NUMA",
    description: "Din dagsbudget — se vad som är kvar idag, planera och håll koll på saldot.",
    images: [{ url: BRAND_ICON_512, width: 512, height: 512, alt: "NUMA" }],
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
  themeColor: "#05090b",
  colorScheme: "dark",
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
        <FrozenHomescreenGuard />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
