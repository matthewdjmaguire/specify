import { redirect } from "next/navigation";
import { getNavData } from "@/lib/data/nav";
import { Sidebar } from "@/components/layout/sidebar";
import { BottomNav } from "@/components/layout/bottom-nav";
import { AppHeader } from "@/components/layout/app-header";

// why redirect("/sign-in") here too, not just trusting the proxy: this
// layout also runs for any request the proxy's matcher might not cover
// (its own bugs, config drift) — a defensive second check costs nothing and
// means "no profile" can never render a shell with nothing to show.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile, themes } = await getNavData();
  if (!profile) redirect("/sign-in");

  return (
    <div className="flex min-h-full">
      <Sidebar themes={themes} />
      <div className="flex flex-1 flex-col">
        <AppHeader profile={profile} />
        <main className="flex flex-1 flex-col pb-16 md:pb-0">{children}</main>
      </div>
      <BottomNav themes={themes} />
    </div>
  );
}
