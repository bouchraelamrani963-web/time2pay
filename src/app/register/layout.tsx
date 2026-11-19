import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Account aanmaken | Time2Pay",
  robots: { index: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
