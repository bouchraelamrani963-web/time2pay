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
    <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/70 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-0 group">
          <span className="text-xl font-black tracking-tight text-blue-600 group-hover:text-blue-700 transition-colors">
            Time
          </span>
          <span className="text-xl font-black tracking-tight text-gray-900">2Pay</span>
        </Link>

        <div className="flex items-center gap-1">
          {appLinks.map(({ href, label, icon: Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-150 ${
                  active
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-100"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <Link href="/invoices/new" className="btn-primary">
            <Plus size={16} />
            <span className="hidden sm:inline">Nieuwe factuur</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 hover:text-gray-900"
          >
            <LogOut size={15} />
            <span className="hidden sm:inline">Uitloggen</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
