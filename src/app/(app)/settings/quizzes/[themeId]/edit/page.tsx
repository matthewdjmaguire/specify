import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeForm } from "../../theme-form";

export default async function EditQuizThemePage({ params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  const supabase = await createClient();

  const { data: theme } = await supabase
    .from("quiz_themes")
    .select("id, display_name, prompt")
    .eq("id", themeId)
    .single();
  if (!theme) notFound();

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <h1 className="w-full max-w-md text-2xl font-semibold tracking-tight">Edit quiz theme</h1>
      <ThemeForm themeId={theme.id} initial={{ displayName: theme.display_name, prompt: theme.prompt }} />
    </div>
  );
}
