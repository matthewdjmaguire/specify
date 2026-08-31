"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { resolveThemePlants } from "@/lib/quiz/resolve-theme-plants";
import { selectQuizPlants } from "@/lib/quiz/select-plants";
import { selectFollowupCategories } from "@/lib/quiz/followup-questions";
import { getFavouritePlantIdsCore } from "./favourites";
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
    .select("prompt, is_lucky_dip, is_favourites")
    .eq("id", input.themeId)
    .single();
  if (themeError || !theme) throw new Error("Quiz theme not found");

  // why favourites is resolved separately, not folded into
  // resolveThemePlants: it isn't a prompt-filter at all — it's a per-user
  // set from plant_stats, which resolveThemePlants has no concept of (and
  // shouldn't need to, for every other theme that doesn't care about it).
  let plants: QuizPlant[];
  if (theme.is_favourites) {
    const favouritePlantIds = new Set(await getFavouritePlantIdsCore(supabase, userId));
    const catalogue = await resolveThemePlants(supabase, { prompt: "", isLuckyDip: true }, input.geoScope);
    plants = catalogue.filter((p) => favouritePlantIds.has(p.id));
    if (plants.length === 0) {
      throw new Error(
        favouritePlantIds.size === 0
          ? "You haven't favourited any plants yet."
          : "None of your favourited plants match the selected geographic scope.",
      );
    }
  } else {
    plants = await resolveThemePlants(
      supabase,
      { prompt: theme.prompt, isLuckyDip: theme.is_lucky_dip },
      input.geoScope,
    );
    if (plants.length === 0) {
      throw new Error("No plants match this quiz theme for the selected geographic scope");
    }
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

export type ResumableAttempt = { id: string; geoScope: "UK" | "Global" };

// why only the single most recent incomplete attempt, not a full history:
// per the request this covers — someone got distracted mid-quiz — an older
// abandoned attempt for the same theme+mode is superseded, not something
// to resurface. Older incomplete attempts are simply left alone (not
// deleted); nothing currently queries them once a newer one exists.
//
// why geoScope is returned alongside the id: an attempt's plant list is
// fixed at creation time (startQuizAttemptCore runs resolveThemePlants
// once) — resuming an old attempt always shows whatever geo scope it was
// started with, regardless of the profile's *current* setting. Surfacing
// that here lets the UI explain why "I just changed to Global but the quiz
// still looks the same" isn't a bug — see start-quiz-form.tsx.
export async function getResumableAttemptCore(
  supabase: SupabaseClient,
  userId: string,
  themeId: string,
  mode: StartQuizInput["mode"],
): Promise<ResumableAttempt | null> {
  const { data } = await supabase
    .from("quiz_attempts")
    .select("id, geo_scope")
    .eq("user_id", userId)
    .eq("theme_id", themeId)
    .eq("mode", mode)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { id: data.id, geoScope: data.geo_scope as "UK" | "Global" } : null;
}

export async function getResumableAttempts(
  themeId: string,
): Promise<Partial<Record<StartQuizInput["mode"], ResumableAttempt>>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const modes: StartQuizInput["mode"][] = ["learning", "intermediate", "hard"];
  const entries = await Promise.all(
    modes.map(async (mode) => [mode, await getResumableAttemptCore(supabase, user.id, themeId, mode)] as const),
  );
  return Object.fromEntries(entries.filter(([, attempt]) => attempt !== null)) as Partial<
    Record<StartQuizInput["mode"], ResumableAttempt>
  >;
}

export async function completeQuizAttemptCore(supabase: SupabaseClient, attemptId: string): Promise<void> {
  const { error } = await supabase
    .from("quiz_attempts")
    .update({ completed_at: new Date().toISOString() })
    .eq("id", attemptId);
  if (error) throw error;
}

export async function completeQuizAttempt(attemptId: string): Promise<void> {
  const supabase = await createClient();
  return completeQuizAttemptCore(supabase, attemptId);
}
