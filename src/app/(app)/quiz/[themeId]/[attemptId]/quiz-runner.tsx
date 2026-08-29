"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { PlantFlashcard } from "@/components/quiz/plant-flashcard";
import { IntermediateQuestion } from "@/components/quiz/intermediate-question";
import { HardQuestion } from "@/components/quiz/hard-question";
import { selectDistractors } from "@/lib/quiz/select-distractors";
import { isCloseEnough } from "@/lib/quiz/fuzzy-match";
import { submitAnswer } from "@/app/actions/quiz-questions";
import type { QuizPlant } from "@/lib/quiz/types";

type QuestionState = {
  questionId: string;
  sequence: number;
  status: "correct" | "incorrect" | "skipped" | "unanswered";
  plant: QuizPlant;
  userAnswer: string | null;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

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
    plant: QuizPlant;
  }>;
  catalogue: QuizPlant[];
}) {
  const [index, setIndex] = useState(0);
  const [questions, setQuestions] = useState<QuestionState[]>(() =>
    initialQuestions.map((q) => ({ ...q, userAnswer: null })),
  );
  const current = questions[index];

  // why useMemo keyed on questionId (not state): the options for a question
  // must stay stable across back/forward navigation within one attempt — an
  // already-answered question shouldn't reshuffle its choices if revisited.
  // useMemo achieves that for free as long as the component instance
  // persists (it does; only `index` changes), without needing to stash the
  // options in state and manage a separate "already computed?" check.
  const options = useMemo(() => {
    if (mode !== "intermediate" || !current) return [];
    return shuffle([current.plant, ...selectDistractors(current.plant, catalogue, 3)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.questionId, mode]);

  if (!current) {
    return <p className="p-8 text-center text-muted-foreground">This quiz has no questions.</p>;
  }

  async function handleIntermediateAnswer(option: QuizPlant) {
    const isCorrect = option.id === current.plant.id;
    const status = isCorrect ? "correct" : "incorrect";
    setQuestions((prev) =>
      prev.map((q) =>
        q.questionId === current.questionId ? { ...q, status, userAnswer: option.scientificName } : q,
      ),
    );
    await submitAnswer(current.questionId, status, option.scientificName);
  }

  async function handleHardAnswer(value: string) {
    const isCorrect = isCloseEnough(value, current.plant.scientificName);
    const status = isCorrect ? "correct" : "incorrect";
    setQuestions((prev) =>
      prev.map((q) => (q.questionId === current.questionId ? { ...q, status, userAnswer: value } : q)),
    );
    await submitAnswer(current.questionId, status, value);
  }

  const answeredOption = options.find((o) => o.scientificName === current.userAnswer);

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <p className="text-sm text-muted-foreground">
        Question {index + 1} of {questions.length}
      </p>

      {mode === "learning" && <PlantFlashcard plant={current.plant} revealed />}

      {mode === "intermediate" && (
        <IntermediateQuestion
          plant={current.plant}
          options={options}
          answeredId={answeredOption?.id ?? null}
          onSelect={handleIntermediateAnswer}
        />
      )}

      {mode === "hard" && (
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
