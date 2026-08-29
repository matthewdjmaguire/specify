"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveThemePlants } from "@/lib/quiz/resolve-theme-plants";
import { selectQuizPlants } from "@/lib/quiz/select-plants";
import { selectFollowupCategories } from "@/lib/quiz/followup-questions";
import type { QuizPlant } from "@/lib/quiz/types";

export type StartQuizInput = {
  themeId: string;
  mode: "learning" | "intermediate" | "hard";
  geoScope: "UK" | "Global";
  questionCount: number;
};

// why split from the exported server action below: "use server" functions
// read cookies via next/headers, which only works inside a real Next.js
// request — tests can't call them directly. Everything that's actually
// *logic* lives here, taking a plain SupabaseClient + userId, so tests
// exercise the exact same code the server action runs, not a duplicate.
export async function startQuizAttemptCore(
  supabase: SupabaseClient,
  userId: string,
  input: StartQuizInput,
): Promise<string> {
  const { data: theme, error: themeError } = await supabase
    .from("quiz_themes")
    .select("prompt, is_lucky_dip")
    .eq("id", input.themeId)
    .single();
  if (themeError || !theme) throw new Error("Quiz theme not found");

  const plants = await resolveThemePlants(
    supabase,
    { prompt: theme.prompt, isLuckyDip: theme.is_lucky_dip },
    input.geoScope,
  );
  if (plants.length === 0) {
    throw new Error("No plants match this quiz theme for the selected geographic scope");
  }

  const { data: statsRows } = await supabase
    .from("plant_stats")
    .select("plant_id, priority_weight")
    .eq("user_id", userId)
    .in(
      "plant_id",
      plants.map((p) => p.id),
    );
  const weights = new Map((statsRows ?? []).map((row) => [row.plant_id, row.priority_weight]));

  const selected = selectQuizPlants(plants, weights, input.questionCount);

  const { data: attempt, error: attemptError } = await supabase
    .from("quiz_attempts")
    .insert({
      user_id: userId,
      theme_id: input.themeId,
      mode: input.mode,
      // why selected.length, not input.questionCount: a narrow theme + a
      // restrictive geo scope can legitimately have fewer matching plants
      // than the user's configured quiz length — the stored count should
      // reflect what was actually asked, not what was requested.
      question_count: selected.length,
      geo_scope: input.geoScope,
    })
    .select("id")
    .single();
  if (attemptError) throw attemptError;

  // why not for Learning mode: Learning mode's flashcard already shows every
  // characteristic inline as a teaching aid (SPEC-011) — there's no "name
  // question" to follow up after, since nothing is being tested. Creating
  // characteristic rows there would just leave them permanently unanswered.
  let followupCount = 0;
  if (input.mode !== "learning") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("followup_count")
      .eq("id", userId)
      .single();
    followupCount = profile?.followup_count ?? 1;
  }

  const questionRows: Array<{
    attempt_id: string;
    plant_id: string;
    question_type: string;
    sequence: number;
  }> = [];
  let sequence = 1;
  for (const plant of selected as QuizPlant[]) {
    questionRows.push({ attempt_id: attempt.id, plant_id: plant.id, question_type: "name", sequence: sequence++ });
    if (followupCount > 0) {
      const categories = selectFollowupCategories(plant, followupCount);
      for (const category of categories) {
        questionRows.push({
          attempt_id: attempt.id,
          plant_id: plant.id,
          question_type: `characteristic:${category}`,
          sequence: sequence++,
        });
      }
    }
  }

  const { error: questionsError } = await supabase.from("quiz_questions").insert(questionRows);
  if (questionsError) throw questionsError;

  return attempt.id as string;
}

export async function startQuizAttempt(input: StartQuizInput): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  return startQuizAttemptCore(supabase, user.id, input);
}
