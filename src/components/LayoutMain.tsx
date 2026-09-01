"use client";

import { usePathname } from "next/navigation";

/**
 * Renders the page <main> with the right container.
 * - "/" (always the landing page) → full-bleed, no container constraints
 * - All other pages → app container (max-w-[1200px], padded)
 */
export default function LayoutMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <main className="mx-auto w-full max-w-[1200px] px-6 py-10 sm:px-8 sm:py-12">
      {children}
    </main>
  );
}
