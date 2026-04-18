"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const navGroups = [
  {
    label: "Spending",
    links: [
      {
        href: "/transactions",
        label: "Transactions",
        children: [
          { href: "/transactions/summary", label: "Summary" },
        ],
      },
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
      { href: "/housing", label: "Housing" },
      { href: "/subscriptions", label: "Subscriptions" },
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

type NavLink = {
  href: string;
  label: string;
  children?: readonly NavLink[];
};

export function NavBar() {
  const pathname = usePathname();

  if (pathname === "/login") return null;

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const linkClasses = (href: string, isChild = false) =>
    `whitespace-nowrap border-b-2 px-3 ${isChild ? "py-2 text-xs" : "py-3 text-sm"} font-medium transition ${
      isActive(href)
        ? "border-sky-400 text-sky-300"
        : "border-transparent text-stone-500 hover:border-sky-700 hover:text-stone-700"
    }`;

  function renderLink({ href, label, children }: NavLink) {
    return (
      <div key={href} className="flex flex-col">
        <Link href={href} className={linkClasses(href)}>
          {label}
        </Link>
        {children?.map((child) => (
          <Link
            key={child.href}
            href={child.href}
            className={`${linkClasses(child.href, true)} ml-4 self-start`}
          >
            {child.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <nav className="border-b border-stone-200 bg-white backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-0 overflow-x-auto px-4 sm:px-6 lg:px-8">
        <Link href="/" className={linkClasses("/")}>
          Dashboard
        </Link>

        <span className="mx-1 h-5 w-px bg-sky-900/70" />

        {navGroups.map((group, groupIndex) => (
          <div key={group.label} className="flex items-center">
            {groupIndex > 0 && <span className="mx-1 h-5 w-px bg-sky-900/70" />}
            {group.links.map(renderLink)}
          </div>
        ))}

        <span className="mx-1 h-5 w-px bg-sky-900/70" />

        <Link href="/settings" className={linkClasses("/settings")}>
          Settings
        </Link>

        <div className="ml-auto flex items-center">
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="whitespace-nowrap border-b-2 border-transparent px-3 py-3 text-sm font-medium text-stone-500 transition hover:border-sky-700 hover:text-stone-700"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
