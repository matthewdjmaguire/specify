import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAdminDirectory } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { ThemeRow } from "../settings/quizzes/theme-row";
import { UserRow } from "./user-row";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  // why redirect rather than a "not authorised" page: the nav link is
  // already hidden for non-admins (SPEC-008) — reaching this by typing the
  // URL directly is either an honest mistake or a probe, neither of which
  // benefits from confirming the route exists.
  if (!profile?.is_admin) redirect("/");

  const [directory, { data: globalThemes }] = await Promise.all([
    getAdminDirectory(),
    supabase
      .from("quiz_themes")
      .select("id, display_name, prompt")
      .eq("is_global", true)
      .order("display_name"),
  ]);

  return (
    <div className="flex flex-1 flex-col items-center gap-8 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <h2 className="text-lg font-medium">Users</h2>
        <div className="flex flex-col gap-2">
          {directory.map((entry) => (
            <UserRow key={entry.id} entry={entry} currentUserId={user.id} />
          ))}
        </div>
      </section>

      <section className="flex w-full max-w-2xl flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">Global quiz themes</h2>
          <Button size="sm" render={<Link href="/admin/themes/new">New global theme</Link>} />
        </div>
        <div className="flex flex-col gap-2">
          {(globalThemes ?? []).map((theme) => (
            <ThemeRow key={theme.id} id={theme.id} displayName={theme.display_name} prompt={theme.prompt} />
          ))}
        </div>
      </section>
    </div>
  );
}
