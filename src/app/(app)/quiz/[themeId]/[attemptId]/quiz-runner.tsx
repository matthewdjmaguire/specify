"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlantFlashcard } from "@/components/quiz/plant-flashcard";
import type { QuizPlant } from "@/lib/quiz/types";

type QuestionItem = {
  questionId: string;
  sequence: number;
  status: "correct" | "incorrect" | "skipped" | "unanswered";
  plant: QuizPlant;
};

export function QuizRunner({
  mode,
  questions,
}: {
  attemptId: string;
  mode: "learning" | "intermediate" | "hard";
  questions: QuestionItem[];
}) {
  const [index, setIndex] = useState(0);
  const current = questions[index];

  if (!current) {
    return <p className="p-8 text-center text-muted-foreground">This quiz has no questions.</p>;
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <p className="text-sm text-muted-foreground">
        Question {index + 1} of {questions.length}
      </p>

      {mode === "learning" ? (
        <PlantFlashcard plant={current.plant} revealed />
      ) : (
        // why a placeholder, not a crash: Intermediate (SPEC-012) and Hard
        // (SPEC-013) mode question UIs land in separate tickets on top of
        // this same runner — this keeps the runner itself shippable now
        // rather than blocking on all three modes landing at once.
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <PlantFlashcard plant={current.plant} revealed={false} />
          <p className="text-sm text-muted-foreground">
            {mode === "intermediate" ? "Intermediate" : "Hard"} mode question UI is coming soon.
          </p>
        </div>
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
