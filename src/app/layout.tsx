import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LayoutMain from "@/components/LayoutMain";
import { Toaster } from "react-hot-toast";
import { getSession } from "@/lib/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Time2Pay | Facturatie voor zelfstandigen",
  description:
    "Je werk gedaan. Je factuur geregeld. Registreer uren, gebruik verschillende tarieven en maak professionele facturen met Time2Pay.",
  icons: { icon: "/brand/time2pay-icon.svg", shortcut: "/brand/time2pay-icon.svg" },
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
