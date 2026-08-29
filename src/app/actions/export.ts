"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { generateQuizHistoryCsv, type AttemptExportRow } from "@/lib/quiz/csv-export";

type AttemptRow = {
  id: string;
  mode: string;
  started_at: string;
  completed_at: string | null;
  quiz_themes: { display_name: string } | null;
};

export async function exportQuizHistoryCore(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data: attempts } = await supabase
    .from("quiz_attempts")
    .select("id, mode, started_at, completed_at, quiz_themes(display_name)")
    .eq("user_id", userId)
    .order("started_at", { ascending: false });

  const attemptIds = ((attempts ?? []) as unknown as AttemptRow[]).map((a) => a.id);
  const { data: questions } =
    attemptIds.length > 0
      ? await supabase
          .from("quiz_questions")
          .select("attempt_id, status")
          .eq("question_type", "name")
          .in("attempt_id", attemptIds)
      : { data: [] as Array<{ attempt_id: string; status: string }> };

  const scoreByAttempt = new Map<string, { correct: number; total: number }>();
  for (const q of (questions ?? []) as Array<{ attempt_id: string; status: string }>) {
    const entry = scoreByAttempt.get(q.attempt_id) ?? { correct: 0, total: 0 };
    entry.total += 1;
    if (q.status === "correct") entry.correct += 1;
    scoreByAttempt.set(q.attempt_id, entry);
  }

  const rows: AttemptExportRow[] = ((attempts ?? []) as unknown as AttemptRow[]).map((a) => {
    const score = scoreByAttempt.get(a.id) ?? { correct: 0, total: 0 };
    return {
      themeName: a.quiz_themes?.display_name ?? "Unknown",
      mode: a.mode,
      startedAt: a.started_at,
      completedAt: a.completed_at,
      correctCount: score.correct,
      totalQuestions: score.total,
    };
  });

  return generateQuizHistoryCsv(rows);
}

export async function exportQuizHistory(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  return exportQuizHistoryCore(supabase, user.id);
}
