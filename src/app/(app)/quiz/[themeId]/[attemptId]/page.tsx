import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveThemePlants } from "@/lib/quiz/resolve-theme-plants";
import { QuizRunner } from "./quiz-runner";
import type { QuizPlant } from "@/lib/quiz/types";

type QuestionRow = {
  id: string;
  sequence: number;
  status: "correct" | "incorrect" | "skipped" | "unanswered";
  question_type: string;
  plants: {
    id: string;
    scientific_name: string;
    common_name: string | null;
    description: string | null;
    image_url: string | null;
    family: string | null;
    genus: string | null;
    habit: string | null;
    foliage: string | null;
    soil_types: string[];
    moisture: string | null;
    ph: string | null;
    position: string[];
    aspect: string | null;
    exposure: string | null;
    hardiness: string | null;
    height_range: string | null;
    spread_range: string | null;
  };
};

function toQuizPlant(row: QuestionRow["plants"]): QuizPlant {
  return {
    id: row.id,
    scientificName: row.scientific_name,
    commonName: row.common_name,
    description: row.description,
    imageUrl: row.image_url,
    family: row.family,
    genus: row.genus,
    habit: row.habit,
    foliage: row.foliage,
    soilTypes: row.soil_types,
    moisture: row.moisture,
    ph: row.ph,
    position: row.position,
    aspect: row.aspect,
    exposure: row.exposure,
    hardiness: row.hardiness,
    heightRange: row.height_range,
    spreadRange: row.spread_range,
  };
}

export default async function QuizAttemptPage({
  params,
}: {
  params: Promise<{ themeId: string; attemptId: string }>;
}) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id, mode, question_count, geo_scope")
    .eq("id", attemptId)
    .single();
  if (!attempt) notFound();

  const mode = attempt.mode as "learning" | "intermediate" | "hard";

  const [{ data: questions }, catalogue] = await Promise.all([
    supabase
      .from("quiz_questions")
      .select(
        "id, sequence, status, question_type, plants(id, scientific_name, common_name, description, image_url, family, genus, habit, foliage, soil_types, moisture, ph, position, aspect, exposure, hardiness, height_range, spread_range)",
      )
      .eq("attempt_id", attemptId)
      .order("sequence"),
    // why fetched only for intermediate mode: distractor generation is the
    // only thing that needs a broader pool than the attempt's own
    // questions — skip the extra query entirely for Learning/Hard modes.
    mode === "intermediate"
      ? resolveThemePlants(supabase, { prompt: "", isLuckyDip: true }, attempt.geo_scope as "UK" | "Global")
      : Promise.resolve([] as QuizPlant[]),
  ]);

  const items = ((questions ?? []) as unknown as QuestionRow[]).map((q) => ({
    questionId: q.id,
    sequence: q.sequence,
    status: q.status,
    plant: toQuizPlant(q.plants),
  }));

  return <QuizRunner attemptId={attempt.id} mode={mode} questions={items} catalogue={catalogue} />;
}
