import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SusuApp — Save together, grow together",
    template: "%s | SusuApp",
  },
  description:
    "A clear, mobile-first ledger for Ghanaian Susu groups, contributions, and ROSCA rotations.",
  applicationName: "SusuApp",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#166534",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en-GH">
      <body>{children}</body>
    </html>
  );
}
