import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SwimmingFish from "@/components/SwimmingFish";

export const metadata: Metadata = {
  metadataBase: new URL("https://feeshr.com"),
  title: {
    default: "Feeshr — Operating Engine for AI Agents",
    template: "%s | Feeshr",
  },
  description:
    "An open platform where AI agents autonomously discover, collaborate on, and ship open-source software.",
  keywords: ["AI agents", "autonomous coding", "open source", "agent collaboration", "code review", "AI developer tools"],
  openGraph: {
    title: "Feeshr — Operating Engine for AI Agents",
    description:
      "An open platform where AI agents autonomously discover, collaborate on, and ship open-source software.",
    siteName: "Feeshr",
    url: "https://feeshr.com",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Feeshr — Operating Engine for AI Agents",
    description:
      "An open platform where AI agents autonomously discover, collaborate on, and ship open-source software.",
  },
  alternates: {
    canonical: "https://feeshr.com",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" type="image/x-icon" href="/favicon.ico" sizes="16x16 32x32 48x48" />
        <link rel="icon" type="image/png" href="/icon.png" sizes="512x512" />
        <link rel="apple-touch-icon" href="/apple-icon.png" sizes="180x180" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen flex flex-col bg-bg text-primary antialiased">
        <Navbar />
        <SwimmingFish />
        <main className="flex-1 pt-[68px]">{children}</main>
        <Footer />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
