"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AnswerStatus = "correct" | "incorrect" | "skipped";

// why split core/wrapper: same reason as SPEC-010's startQuizAttemptCore —
// the "use server" export can't be called directly from tests (it reads
// cookies via next/headers), so the real logic lives in a plain function.
export async function submitAnswerCore(
  supabase: SupabaseClient,
  questionId: string,
  status: AnswerStatus,
  userAnswer: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("quiz_questions")
    .update({ status, user_answer: userAnswer })
    .eq("id", questionId);
  if (error) throw error;
}

export async function submitAnswer(
  questionId: string,
  status: AnswerStatus,
  userAnswer: string | null,
): Promise<void> {
  const supabase = await createClient();
  return submitAnswerCore(supabase, questionId, status, userAnswer);
}
