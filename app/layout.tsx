import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mind Orbit",
  description: "A tiny AI-inspired mind map for orbiting thoughts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
