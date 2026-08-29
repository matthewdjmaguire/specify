"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PlantFlashcard } from "./plant-flashcard";
import type { QuizPlant } from "@/lib/quiz/types";

export function HardQuestion({
  plant,
  answered,
  isCorrect,
  previousAnswer,
  onSubmit,
}: {
  plant: QuizPlant;
  answered: boolean;
  isCorrect: boolean | null;
  previousAnswer: string | null;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (answered || !value.trim()) return;
    onSubmit(value);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <PlantFlashcard plant={plant} revealed={answered} />
      {!answered ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Scientific name…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm italic outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" disabled={!value.trim()}>
            Submit
          </Button>
        </form>
      ) : (
        <p
          className={`rounded-lg border p-3 text-sm ${
            isCorrect ? "border-success bg-success/10" : "border-destructive bg-destructive/10"
          }`}
        >
          {isCorrect ? "Correct!" : `Not quite — you answered "${previousAnswer}".`}
        </p>
      )}
    </div>
  );
}
