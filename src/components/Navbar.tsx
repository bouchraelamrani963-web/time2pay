"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, Users, Plus } from "lucide-react";

const links = [
  { href: "/", label: "Dashboard", icon: FileText },
  { href: "/invoices", label: "Facturen", icon: FileText },
  { href: "/clients", label: "Klanten", icon: Users },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-black text-blue-600">Time</span>
          <span className="text-xl font-black text-gray-900">2Pay</span>
        </Link>

        <div className="flex items-center gap-1">
          {links.map(({ href, label }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        <Link href="/invoices/new" className="btn-primary">
          <Plus size={16} />
          Nieuwe factuur
        </Link>
      </div>
    </nav>
  );
}
