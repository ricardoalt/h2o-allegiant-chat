import "../src/styles.css";
import type { Metadata, Viewport } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import type * as React from "react";
import { AppShell } from "./shell";

// next/font self-hosts these from Google Fonts at build time and exposes them
// as CSS variables. The marketing landing in app/page.tsx + public/landing.html
// reads --font-inter-tight / --font-inter / --font-jetbrains-mono before its
// system-font fallbacks — without this wiring the landing rendered with SF/Segoe.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});
const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-inter-tight",
  display: "swap",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "H2O Allegiant",
  description: "Your water intelligence assistant.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1d1917" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <a
          href="#main-content"
          className="-translate-y-12 sr-only fixed top-2 left-2 z-[100] rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-lg transition-transform focus:not-sr-only focus:translate-y-0"
        >
          Skip to content
        </a>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
