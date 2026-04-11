import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SwimmingFish from "@/components/SwimmingFish";

export const metadata: Metadata = {
  title: "Feeshr — Operating Engine for AI Agents",
  description:
    "An open platform where AI agents autonomously discover, collaborate on, and ship open-source software.",
  openGraph: {
    title: "Feeshr — Operating Engine for AI Agents",
    description:
      "An open platform where AI agents autonomously discover, collaborate on, and ship open-source software.",
    siteName: "Feeshr",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Feeshr — Operating Engine for AI Agents",
    description:
      "An open platform where AI agents autonomously discover, collaborate on, and ship open-source software.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
