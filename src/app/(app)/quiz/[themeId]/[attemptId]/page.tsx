import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveThemePlants, toQuizPlant, PLANT_COLUMNS, type PlantRow } from "@/lib/quiz/resolve-theme-plants";
import { getFavouritePlantIds } from "@/app/actions/favourites";
import { QuizRunner } from "./quiz-runner";
import type { QuizPlant } from "@/lib/quiz/types";

type QuestionRow = {
  id: string;
  sequence: number;
  status: "correct" | "incorrect" | "skipped" | "unanswered";
  question_type: string;
  plants: PlantRow;
};

export default async function QuizAttemptPage({
  params,
}: {
  params: Promise<{ themeId: string; attemptId: string }>;
}) {
  const { attemptId, themeId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, mode, question_count, geo_scope")
    .eq("id", attemptId)
    .single();
  if (!attempt) notFound();

  const mode = attempt.mode as "learning" | "intermediate" | "hard";

  const [{ data: questions }, catalogue, favouritePlantIds] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select(`id, sequence, status, question_type, plants(${PLANT_COLUMNS})`)
      .eq("attempt_id", attemptId)
      .order("sequence"),
    // why fetched whenever mode !== "learning": Intermediate mode's name
    // question needs a distractor pool, and *any* non-Learning mode's
    // follow-up characteristic questions (SPEC-014) need one too — Learning
    // mode has neither (its flashcard shows everything inline already), so
    // it's the only mode that skips this extra query.
    mode !== "learning"
      ? resolveThemePlants(supabase, { prompt: "", isLuckyDip: true }, attempt.geo_scope as "UK" | "Global")
      : Promise.resolve([] as QuizPlant[]),
    getFavouritePlantIds(),
  ]);

  const items = ((questions ?? []) as unknown as QuestionRow[]).map((q) => ({
    questionId: q.id,
    sequence: q.sequence,
    status: q.status,
    questionType: q.question_type,
    plant: toQuizPlant(q.plants),
  }));

  // why the first unanswered question, not always 0: resuming an
  // in-progress attempt (see start-quiz-form.tsx's "Resume quiz") should
  // pick up where it was left, not restart from the beginning. Falls back
  // to the last question if every question already has an answer (e.g. the
  // attempt just hasn't been explicitly finished yet).
  const firstUnansweredIndex = items.findIndex((q) => q.status === "unanswered");
  const initialIndex = firstUnansweredIndex === -1 ? Math.max(items.length - 1, 0) : firstUnansweredIndex;

  return (
    <QuizRunner
      attemptId={attempt.id}
      themeId={themeId}
      mode={mode}
      questions={items}
      catalogue={catalogue}
      favouritePlantIds={favouritePlantIds}
      initialIndex={initialIndex}
    />
  );
}
