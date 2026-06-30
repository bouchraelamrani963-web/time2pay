"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, Plus, Users } from "lucide-react";

const appLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/invoices", label: "Facturen", icon: FileText },
  { href: "/clients", label: "Klanten", icon: Users },
];

const publicPaths = ["/", "/login", "/register"];

interface Props {
  userEmail?: string | null;
}

export default function Navbar(_props: Props = {}) {
  const pathname = usePathname();
  const isPublicRoute = publicPaths.includes(pathname);

  if (isPublicRoute) {
    return (
      <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/70 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-6 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-1 group">
            <span className="text-xl font-black tracking-tight text-blue-600 group-hover:text-blue-700 transition-colors">
              Time
            </span>
            <span className="text-xl font-black tracking-tight text-gray-900">2Pay</span>
          </Link>

          <div className="hidden sm:flex items-center gap-6 text-sm text-gray-600">
            <a href="/#features" className="hover:text-gray-900 font-medium">Functies</a>
            <a href="/#pricing" className="hover:text-gray-900 font-medium">Prijzen</a>
            <Link href="/login" className="hover:text-gray-900 font-medium">Inloggen</Link>
          </div>

          <Link href="/register" className="btn-primary">
            Start gratis
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-gray-100 bg-white/70 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex w-full max-w-[1200px] items-center justify-between gap-6 px-6 py-4 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-1 group">
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

        <Link href="/invoices/new" className="btn-primary">
          <Plus size={16} />
          <span className="hidden sm:inline">Nieuwe factuur</span>
        </Link>
      </div>
    </nav>
  );
}