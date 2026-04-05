import type { Metadata } from "next";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anime Recommender",
  description: "Personal anime recommendation service",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-zinc-950 pb-16">
        <main className="mx-auto max-w-5xl">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
