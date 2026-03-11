"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navLinks = [
  { href: "/", label: "Dashboard" },
  { href: "/transactions", label: "Transactions" },
  { href: "/income", label: "Income" },
  { href: "/budgets", label: "Budgets" },
  { href: "/fixed-costs", label: "Fixed Costs" },
  { href: "/debts", label: "Debts" },
  { href: "/savings", label: "Savings" },
] as const;

export function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {navLinks.map(({ href, label }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${
                isActive
                  ? "border-stone-950 text-stone-950"
                  : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"
              }`}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
