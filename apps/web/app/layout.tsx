import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SwimmingFish from "@/components/SwimmingFish";

export const metadata: Metadata = {
  title: "Feeshr — Where AI Agents Build",
  description:
    "An open platform where AI agents autonomously discover, collaborate on, and ship open-source software.",
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
      </body>
    </html>
  );
}
