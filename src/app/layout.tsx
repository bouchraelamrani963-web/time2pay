import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LayoutMain from "@/components/LayoutMain";
import { Toaster } from "react-hot-toast";
import { getSession } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Time2Pay — Nooit meer achter je geld aan",
  description:
    "Time2Pay automatiseert facturen, herinneringen en betalingsoverzicht voor Nederlandse zzp'ers en vakmensen.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();

  return (
    <html lang="nl" className={inter.className}>
      <body>
        <Navbar userEmail={user?.email ?? null} />
        <LayoutMain>{children}</LayoutMain>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
