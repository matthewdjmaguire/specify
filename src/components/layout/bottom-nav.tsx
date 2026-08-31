"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, Home, LayoutGrid, Leaf, Shuffle } from "lucide-react";
import type { NavTheme } from "@/lib/data/nav";

export function BottomNav({ themes }: { themes: NavTheme[] }) {
  const pathname = usePathname();
  const luckyDip = themes.find((t) => t.isLuckyDip);

  const items = [
    { href: "/", label: "Home", icon: Home },
    ...(luckyDip ? [{ href: `/quiz/${luckyDip.id}`, label: "Lucky Dip", icon: Shuffle }] : []),
    { href: "/quizzes", label: "Quizzes", icon: LayoutGrid },
    { href: "/browse", label: "Browse", icon: Leaf },
    { href: "/favourites", label: "Favourites", icon: Heart },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card md:hidden">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ${
              active ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
