import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mexxej — 3D Holiday Planner",
  description: "Plan and explore your group trip in immersive 3D.",
  viewport: "width=device-width, initial-scale=1, maximum-scale=1",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
