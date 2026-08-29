import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { ThemeRow } from "./theme-row";

export default async function SettingsQuizzesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: themes } = await supabase
    .from("quiz_themes")
    .select("id, display_name, prompt")
    .eq("owner_id", user.id)
    .order("display_name");

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="flex w-full max-w-md items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Your quiz themes</h1>
        <Button size="sm" render={<Link href="/settings/quizzes/new">New theme</Link>} />
      </div>

      <div className="flex w-full max-w-md flex-col gap-2">
        {(themes ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            You haven&apos;t created any quiz themes yet. Global themes (like Lucky Dip) are always available from
            the sidebar.
          </p>
        )}
        {(themes ?? []).map((theme) => (
          <ThemeRow key={theme.id} id={theme.id} displayName={theme.display_name} prompt={theme.prompt} />
        ))}
      </div>
    </div>
  );
}
