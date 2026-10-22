"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, Plus, Settings, Users } from "lucide-react";

const appLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/invoices", label: "Facturen", icon: FileText },
  { href: "/clients", label: "Klanten", icon: Users },
  { href: "/settings", label: "Instellingen", icon: Settings },
];

const publicPaths = ["/", "/login", "/register"];

interface Props {
  userEmail?: string | null;
}

export default function Navbar(_props: Props = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublicRoute = publicPaths.includes(pathname);

  async function handleLogout() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/login");
    router.refresh();
  }

  if (isPublicRoute) {
    return (
      <nav className="sticky top-0 z-40 border-b border-[#e9deda] bg-[#fbf8f5]">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between gap-4 px-6 py-5 sm:px-8">
          <Link href="/" className="text-xl font-bold tracking-[-0.045em] text-[#4a3042]">
            Time2Pay<span className="text-[#b3846d]">.</span>
          </Link>
          <div className="hidden items-center gap-9 text-sm font-medium text-[#786d73] sm:flex">
            <a href="/#how-it-works" className="hover:text-[#4a3042]">Werkwijze</a>
            <a href="/#features" className="hover:text-[#4a3042]">Functies</a>
            <a href="/#pricing" className="hover:text-[#4a3042]">Prijzen</a>
            <Link href="/login" className="hover:text-[#4a3042]">Inloggen</Link>
          </div>
          <Link href="/register" className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#543749] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3e2937] sm:px-5">
            Begin gratis
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-[#e9deda] bg-[#fffdfb]">
      <div className="mx-auto max-w-[1240px] px-4 sm:px-8">
        <div className="flex min-h-[76px] items-center justify-between gap-4">
          <Link href="/dashboard" className="shrink-0 text-xl font-bold tracking-[-0.045em] text-[#543749]">
            Time2Pay<span className="text-[#b3846d]">.</span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {appLinks.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link key={href} href={href} aria-current={active ? "page" : undefined}
                  className={`inline-flex items-center gap-2 rounded-md px-3.5 py-2.5 text-sm font-medium transition-colors ${active ? "bg-[#f8f0eb] text-[#543749]" : "text-[#716671] hover:bg-[#fbf8f5] hover:text-[#543749]"}`}>
                  <Icon size={16} aria-hidden />{label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/invoices/new" aria-label="Nieuwe factuur" className="btn-primary px-3 sm:px-5">
              <Plus size={16} aria-hidden /><span className="hidden sm:inline">Nieuwe factuur</span>
            </Link>
            <button type="button" onClick={handleLogout} aria-label="Uitloggen"
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-[#e2d8d5] bg-white px-3 py-2 text-sm font-medium text-[#62555f] hover:bg-[#fbf8f5] sm:px-4">
              <LogOut size={16} aria-hidden /><span className="hidden sm:inline">Uitloggen</span>
            </button>
          </div>
        </div>
        <div className="-mx-4 flex gap-1 overflow-x-auto border-t border-[#f0e7e4] px-4 py-2 sm:-mx-8 sm:px-8 lg:hidden" aria-label="Hoofdnavigatie">
          {appLinks.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium ${active ? "bg-[#f8f0eb] text-[#543749]" : "text-[#716671] hover:bg-[#fbf8f5]"}`}>
                <Icon size={15} aria-hidden />{label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
