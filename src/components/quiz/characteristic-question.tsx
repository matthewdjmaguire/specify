"use client";

import type { FollowupQuestionView } from "@/lib/quiz/followup-questions";

export function CharacteristicQuestion({
  question,
  answeredValue,
  onSelect,
}: {
  question: FollowupQuestionView;
  answeredValue: string | null;
  onSelect: (value: string) => void;
}) {
  const showFeedback = answeredValue !== null;

  return (
    <div className="flex w-full max-w-md flex-col gap-3">
      <p className="text-sm font-medium text-muted-foreground">{question.label}?</p>
      <div className="flex flex-col gap-2">
        {question.options.map((option) => {
          const isCorrect = option === question.correctValue;
          const isSelected = option === answeredValue;
          return (
            <button
              key={option}
              type="button"
              onClick={() => onSelect(option)}
              disabled={showFeedback}
              className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-default ${
                showFeedback && isCorrect
                  ? "border-success bg-success/10"
                  : showFeedback && isSelected
                    ? "border-destructive bg-destructive/10"
                    : "border-border hover:bg-muted"
              }`}
            >
              {option}
            </button>
          );
        })}
      </div>
    </div>
  );
}
