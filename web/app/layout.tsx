import type { Metadata } from "next";
import { Lexend, Newsreader } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import { Amplitude } from "./amplitude";
import MyStatsig from "./my-statsig";
import "./globals.css";

// Lexend was designed to improve reading proficiency — a good fit for Milo's users.
const lexend = Lexend({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });
const newsreader = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });

export const metadata: Metadata = {
  title: "Milo — the personal agent you can talk to any way",
  description: "Text, voice, head movement or sign. Milo predicts, confirms, acts and keeps receipts.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${lexend.variable} ${newsreader.variable}`}>
      <body className="font-sans">
        <Amplitude />
        <MyStatsig>
          <AppShell>{children}</AppShell>
        </MyStatsig>
      </body>
    </html>
  );
}
