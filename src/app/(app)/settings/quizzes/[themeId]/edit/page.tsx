import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeForm } from "../../theme-form";

export default async function EditQuizThemePage({ params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  const supabase = await createClient();

  const { data: theme } = await supabase
    .from("quiz_themes")
    .select("id, display_name, prompt, is_global")
    .eq("id", themeId)
    .single();
  if (!theme) notFound();

  const backHref = theme.is_global ? "/admin" : "/settings/quizzes";

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="w-full max-w-md">
        <Link href={backHref} className="text-sm text-primary underline-offset-2 hover:underline">
          ← {theme.is_global ? "Admin" : "Manage quizzes"}
        </Link>
      </div>
      <h1 className="w-full max-w-md text-2xl font-semibold tracking-tight">Edit quiz theme</h1>
      <ThemeForm
        themeId={theme.id}
        initial={{ displayName: theme.display_name, prompt: theme.prompt }}
        redirectTo={backHref}
      />
    </div>
  );
}
