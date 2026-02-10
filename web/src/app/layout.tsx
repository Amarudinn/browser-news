import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Browser News — Live Aggregator",
  description: "Real-time curated news from 20+ global sources",
  icons: {
    icon: "/browser-news.png",
    apple: "/browser-news.png",
  },
  manifest: "/manifest.json",
  themeColor: "#0a0a0b",
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
