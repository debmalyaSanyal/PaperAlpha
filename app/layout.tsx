import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PaperAlpha",
  description: "Turn your research into a publication-ready paper.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
