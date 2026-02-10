import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
};

export const metadata: Metadata = {
  title: "Browser News — Live Aggregator",
  description: "Real-time curated news from 20+ global sources",
  icons: {
    icon: "/browser-news.png",
    apple: "/browser-news.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
