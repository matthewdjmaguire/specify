"use client";

import { PlantFlashcard } from "./plant-flashcard";
import type { QuizPlant } from "@/lib/quiz/types";

export function IntermediateQuestion({
  plant,
  options,
  answeredId,
  onSelect,
}: {
  plant: QuizPlant;
  options: QuizPlant[];
  answeredId: string | null;
  onSelect: (option: QuizPlant) => void;
}) {
  const showFeedback = answeredId !== null;

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <PlantFlashcard plant={plant} revealed={showFeedback} />
      <div className="flex flex-col gap-2">
        {options.map((option) => {
          const isCorrect = option.id === plant.id;
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
