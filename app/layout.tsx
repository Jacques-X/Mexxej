import type { Metadata, Viewport } from "next";
import { Big_Shoulders, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const bigShoulders = Big_Shoulders({
  weight: ["700", "900"],
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mexxej — Group Trip Planner",
  description: "Drop pins. Share the link. Plan your group trip on a live 3D map.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full ${bigShoulders.variable} ${jetbrainsMono.variable}`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
