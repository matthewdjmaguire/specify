import Link from "next/link";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import type { NavTheme } from "@/lib/data/nav";

const MAX_SIDEBAR_THEMES = 8;

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    >
      {children}
    </Link>
  );
}

// why desktop-only here (hidden md:flex) rather than one responsive
// component shared with BottomNav: the two have different content shapes
// (full theme list vs. a handful of icons) and different layout roles (a
// persistent side column vs. a fixed bottom bar) — trying to unify them
// would mean more conditional branches than just two small components.
export function Sidebar({ themes }: { themes: NavTheme[] }) {
  const luckyDip = themes.find((t) => t.isLuckyDip);
  const otherThemes = themes.filter((t) => !t.isLuckyDip);
  const visibleThemes = otherThemes.slice(0, MAX_SIDEBAR_THEMES);
  const hasMore = otherThemes.length > MAX_SIDEBAR_THEMES;

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-1 border-r bg-sidebar p-4 md:flex">
      <Link href="/" className="mb-4 flex items-center gap-2 px-2">
        <Image src="/logo.svg" alt="" width={28} height={28} />
        <span className="text-lg font-semibold text-sidebar-foreground">Specify</span>
      </Link>
      <NavLink href="/">Home</NavLink>
      <NavLink href="/favourites">Favourites</NavLink>
      <Separator className="my-2" />
      <p className="px-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">Quizzes</p>
      {luckyDip && <NavLink href={`/quiz/${luckyDip.id}`}>{luckyDip.displayName}</NavLink>}
      {visibleThemes.map((theme) => (
        <NavLink key={theme.id} href={`/quiz/${theme.id}`}>
          {theme.displayName}
        </NavLink>
      ))}
      {hasMore && (
        <NavLink href="/quizzes">
          See all quizzes ({otherThemes.length})
        </NavLink>
      )}
    </aside>
  );
}
