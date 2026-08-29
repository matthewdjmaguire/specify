"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

// why this no longer renders PlantFlashcard itself: the two-stage reveal
// (name only after Q1, full card only after Q2) is computed once in the
// runner and applies uniformly across Intermediate/Hard/follow-up
// questions — duplicating that logic per question-type component would
// have meant three places to keep in sync.
export function HardQuestion({
  answered,
  isCorrect,
  previousAnswer,
  onSubmit,
}: {
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
      {!answered ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            data-testid="hard-answer-input"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Scientific name…"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm italic outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <Button type="submit" data-testid="hard-answer-submit" disabled={!value.trim()}>
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
