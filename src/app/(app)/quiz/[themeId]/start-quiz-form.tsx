"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { startQuizAttempt, type StartQuizInput } from "@/app/actions/quiz-attempts";

const MODES: Array<{ value: StartQuizInput["mode"]; label: string; description: string }> = [
  { value: "learning", label: "Learning", description: "See the name and characteristics alongside each photo." },
  { value: "intermediate", label: "Intermediate", description: "Choose the right name from 4 options." },
  { value: "hard", label: "Hard", description: "Type the scientific name yourself." },
];

export function StartQuizForm({
  themeId,
  geoScope,
  questionCount,
  resumableAttempts,
}: {
  themeId: string;
  geoScope: "UK" | "Global";
  questionCount: number;
  // why keyed by mode, not a single id: which mode is "resumable" depends on
  // which one the user picks below — only the most recent incomplete
  // attempt per mode matters (see getResumableAttemptCore).
  resumableAttempts: Partial<Record<StartQuizInput["mode"], string>>;
}) {
  const [mode, setMode] = useState<StartQuizInput["mode"]>("learning");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const resumableAttemptId = resumableAttempts[mode];

  function handleStart(forceNew: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        if (resumableAttemptId && !forceNew) {
          router.push(`/quiz/${themeId}/${resumableAttemptId}`);
          return;
        }
        const attemptId = await startQuizAttempt({ themeId, mode, geoScope, questionCount });
        router.push(`/quiz/${themeId}/${attemptId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start the quiz.");
      }
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-2">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            data-testid={`mode-${m.value}`}
            onClick={() => setMode(m.value)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              mode === m.value ? "border-primary bg-secondary" : "border-border hover:bg-muted"
            }`}
          >
            <p className="font-medium">{m.label}</p>
            <p className="text-sm text-muted-foreground">{m.description}</p>
          </button>
        ))}
      </div>
      {resumableAttemptId && (
        <p className="text-xs text-muted-foreground">You have an unfinished {mode} attempt for this quiz.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-col items-center gap-2">
        <Button data-testid="start-quiz" onClick={() => handleStart(false)} disabled={isPending} size="lg">
          {isPending ? "Starting…" : resumableAttemptId ? "Resume quiz" : "Start quiz"}
        </Button>
        {resumableAttemptId && (
          <button
            type="button"
            onClick={() => handleStart(true)}
            disabled={isPending}
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            Start a new attempt instead
          </button>
        )}
      </div>
    </div>
  );
}
