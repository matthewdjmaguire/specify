"use client";

import type { QuizPlant } from "@/lib/quiz/types";

// why this no longer renders PlantFlashcard itself: see HardQuestion's
// comment — the two-stage reveal is computed once, in the runner.
export function IntermediateQuestion({
  correctPlantId,
  options,
  answeredId,
  onSelect,
}: {
  correctPlantId: string;
  options: QuizPlant[];
  answeredId: string | null;
  onSelect: (option: QuizPlant) => void;
}) {
  const showFeedback = answeredId !== null;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isCorrect = option.id === correctPlantId;
          const isSelected = option.id === answeredId;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option)}
              disabled={showFeedback}
              className={`rounded-lg border p-3 text-left italic transition-colors disabled:cursor-default ${
                showFeedback && isCorrect
                  ? "border-success bg-success/10"
                  : showFeedback && isSelected
                    ? "border-destructive bg-destructive/10"
                    : "border-border hover:bg-muted"
              }`}
            >
              {option.scientificName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
