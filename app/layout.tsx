import type { Metadata, Viewport } from "next";
import { Averia_Sans_Libre } from "next/font/google";
import { resolveTheme } from "@/lib/theme";
import "./globals.css";

// Self-hosted at build time: the kiosk never reaches out to Google Fonts, so a
// flaky connection can't strip the school's typeface off the board.
const averia = Averia_Sans_Libre({
  subsets: ["latin"],
  weight: ["300", "400", "700"],
  display: "swap",
  variable: "--font-averia",
});

export const metadata: Metadata = {
  title: "Infoborden — Steinerschool Gent",
  description: "Vervangingen, mededelingen en verjaardagen",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Layouts don't receive searchParams, so this is the environment-level
  // default; a page can still override it per screen (see ThemeScope).
  const { theme, accent } = resolveTheme();

  return (
    <html lang="nl" data-theme={theme} data-accent={accent}>
      <body className={averia.variable}>{children}</body>
    </html>
  );
}
