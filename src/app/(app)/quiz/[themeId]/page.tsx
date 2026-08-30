import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getResumableAttempts } from "@/app/actions/quiz-attempts";
import { StartQuizForm } from "./start-quiz-form";

export default async function QuizThemePage({ params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: theme }, { data: profile }, resumableAttempts] = await Promise.all([
    supabase.from("quiz_themes").select("id, display_name, is_lucky_dip").eq("id", themeId).single(),
    user
      ? supabase.from("profiles").select("geo_scope, quiz_length").eq("id", user.id).single()
      : Promise.resolve({ data: null }),
    getResumableAttempts(themeId),
  ]);

  if (!theme) notFound();

  const geoScope = (profile?.geo_scope ?? "UK") as "UK" | "Global";
  const questionCount = profile?.quiz_length ?? 20;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{theme.display_name}</h1>
        <p className="text-sm text-muted-foreground">
          {questionCount} questions · {geoScope} plants
        </p>
      </div>
      <StartQuizForm
        themeId={theme.id}
        geoScope={geoScope}
        questionCount={questionCount}
        resumableAttempts={resumableAttempts}
      />
    </div>
  );
}
