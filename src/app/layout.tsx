import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
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
  title: "NUMA",
  description: "Personlig ekonomi i realtid — kvar per dag, plan och saldo.",
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
  themeColor: "#e6eee9",
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
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
