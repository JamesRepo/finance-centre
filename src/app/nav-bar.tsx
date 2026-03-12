"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navGroups = [
  {
    label: "Spending",
    links: [
      { href: "/transactions", label: "Transactions" },
      { href: "/budgets", label: "Budgets" },
    ],
  },
  {
    label: "Tracking",
    links: [
      { href: "/debts", label: "Debts" },
      { href: "/savings", label: "Savings" },
    ],
  },
  {
    label: "Fixed",
    links: [
      { href: "/fixed-costs", label: "Fixed Costs" },
      { href: "/income", label: "Income" },
    ],
  },
  {
    label: "Travel",
    links: [
      { href: "/holidays", label: "Holidays" },
    ],
  },
] as const;

export function NavBar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const linkClasses = (href: string) =>
    `whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${
      isActive(href)
        ? "border-stone-950 text-stone-950"
        : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700"
    }`;

  return (
    <nav className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-0 overflow-x-auto px-4 sm:px-6 lg:px-8">
        <Link href="/" className={linkClasses("/")}>
          Dashboard
        </Link>

        <span className="mx-1 h-5 w-px bg-stone-200" />

        {navGroups.map((group, groupIndex) => (
          <div key={group.label} className="flex items-center">
            {groupIndex > 0 && <span className="mx-1 h-5 w-px bg-stone-200" />}
            {group.links.map(({ href, label }) => (
              <Link key={href} href={href} className={linkClasses(href)}>
                {label}
              </Link>
            ))}
          </div>
        ))}

        <span className="mx-1 h-5 w-px bg-stone-200" />

        <Link href="/settings" className={linkClasses("/settings")}>
          Settings
        </Link>

        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-stone-500 transition hover:border-stone-300 hover:text-stone-700"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
