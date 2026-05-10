import type { Metadata, Viewport } from "next";
import { Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  weight: ["400"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mexxej — 3D Holiday Planner",
  description: "Plan and explore your group trip in immersive 3D.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`h-full ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
      style={
        {
          "--mxj-serif": `var(--font-serif), 'Cormorant Garamond', 'Times New Roman', serif`,
          "--mxj-mono": `var(--font-mono), 'IBM Plex Mono', monospace`,
        } as React.CSSProperties
      }
    >
      <body className="h-full">{children}</body>
    </html>
  );
}
