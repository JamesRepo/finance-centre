import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { prisma } from "@/lib/prisma";
import "./globals.css";
import { NavBar } from "./nav-bar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Centre",
  description: "Personal finance tracking dashboard",
};

async function getSavedTheme() {
  try {
    const settings = await prisma.settings.findFirst({
      select: { theme: true },
    });

    return settings?.theme === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = await getSavedTheme();

  return (
    <html lang="en" data-theme={theme} className={theme === "dark" ? "dark" : undefined}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <NavBar />
        {children}
      </body>
    </html>
  );
}
