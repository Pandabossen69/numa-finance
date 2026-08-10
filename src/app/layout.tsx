import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
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
  themeColor: "#e6eee9",
  colorScheme: "light",
};

export const dynamic = "force-dynamic";

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
