"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlantFlashcard } from "@/components/quiz/plant-flashcard";
import { IntermediateQuestion } from "@/components/quiz/intermediate-question";
import { HardQuestion } from "@/components/quiz/hard-question";
import { CharacteristicQuestion } from "@/components/quiz/characteristic-question";
import { selectDistractors } from "@/lib/quiz/select-distractors";
import { isCloseEnough } from "@/lib/quiz/fuzzy-match";
import { buildFollowupQuestion, type FollowupCategory } from "@/lib/quiz/followup-questions";
import { shuffle } from "@/lib/quiz/random-utils";
import { submitAnswer } from "@/app/actions/quiz-questions";
import { recordPlantMastery } from "@/app/actions/plant-stats";
import type { QuizPlant } from "@/lib/quiz/types";

type QuestionState = {
  questionId: string;
  sequence: number;
  status: "correct" | "incorrect" | "skipped" | "unanswered";
  questionType: string;
  plant: QuizPlant;
  userAnswer: string | null;
};

export function QuizRunner({
  mode,
  questions: initialQuestions,
  catalogue,
}: {
  attemptId: string;
  mode: "learning" | "intermediate" | "hard";
  questions: Array<{
    questionId: string;
    sequence: number;
    status: QuestionState["status"];
    questionType: string;
    plant: QuizPlant;
  }>;
  catalogue: QuizPlant[];
}) {
  const [index, setIndex] = useState(0);
  const [questions, setQuestions] = useState<QuestionState[]>(() =>
    initialQuestions.map((q) => ({ ...q, userAnswer: null })),
  );
  const current = questions[index];
  const isFollowup = current?.questionType.startsWith("characteristic:") ?? false;
  const followupCategory = isFollowup
    ? (current.questionType.split(":")[1] as FollowupCategory)
    : null;

  // why useMemo keyed on questionId (not state): options/questions must stay
  // stable across back/forward navigation within one attempt — revisiting an
  // already-answered question shouldn't reshuffle its choices. useMemo
  // achieves that for free as long as the component instance persists (it
  // does; only `index` changes).
  const intermediateOptions = useMemo(() => {
    if (mode !== "intermediate" || isFollowup || !current) return [];
    return shuffle([current.plant, ...selectDistractors(current.plant, catalogue, 3)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.questionId, mode, isFollowup]);

  const followupQuestion = useMemo(() => {
    if (!isFollowup || !current || !followupCategory) return null;
    return buildFollowupQuestion(current.plant, followupCategory, catalogue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.questionId, isFollowup, followupCategory]);

  if (!current) {
    return <p className="p-8 text-center text-muted-foreground">This quiz has no questions.</p>;
  }

  async function recordAnswer(value: string, isCorrect: boolean) {
    const status = isCorrect ? "correct" : "incorrect";
    setQuestions((prev) =>
      prev.map((q) => (q.questionId === current.questionId ? { ...q, status, userAnswer: value } : q)),
    );
    // why plant_stats only updates for the name question, not follow-ups:
    // priority_weight (SPEC-010's selection input) is about "recognise this
    // plant by name" specifically — see plant-stats.ts's own comment.
    await Promise.all([
      submitAnswer(current.questionId, status, value),
      isFollowup ? Promise.resolve() : recordPlantMastery(current.plant.id, isCorrect),
    ]);
  }

  async function handleIntermediateAnswer(option: QuizPlant) {
    await recordAnswer(option.scientificName, option.id === current.plant.id);
  }

  async function handleHardAnswer(value: string) {
    await recordAnswer(value, isCloseEnough(value, current.plant.scientificName));
  }

  async function handleFollowupAnswer(value: string) {
    if (!followupQuestion) return;
    await recordAnswer(value, value === followupQuestion.correctValue);
  }

  const answeredIntermediateOption = intermediateOptions.find((o) => o.scientificName === current.userAnswer);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <p className="text-sm text-muted-foreground">
        Question {index + 1} of {questions.length}
      </p>

      {isFollowup && followupQuestion && (
        <>
          <PlantFlashcard plant={current.plant} revealed={current.status !== "unanswered"} />
          <CharacteristicQuestion
            question={followupQuestion}
            answeredValue={current.userAnswer}
            onSelect={handleFollowupAnswer}
          />
        </>
      )}

      {!isFollowup && mode === "learning" && <PlantFlashcard plant={current.plant} revealed />}

      {!isFollowup && mode === "intermediate" && (
        <IntermediateQuestion
          plant={current.plant}
          options={intermediateOptions}
          answeredId={answeredIntermediateOption?.id ?? null}
          onSelect={handleIntermediateAnswer}
        />
      )}

      {!isFollowup && mode === "hard" && (
        <HardQuestion
          key={current.questionId}
          plant={current.plant}
          answered={current.status !== "unanswered"}
          isCorrect={current.status === "correct"}
          previousAnswer={current.userAnswer}
          onSubmit={handleHardAnswer}
        />
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
          Back
        </Button>
        <Button
          onClick={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
          disabled={index === questions.length - 1}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
