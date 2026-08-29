"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createGlobalQuizTheme, createQuizTheme, updateQuizTheme, type QuizThemeInput } from "@/app/actions/quiz-themes";

export function ThemeForm({
  themeId,
  initial,
  isGlobal = false,
  redirectTo = "/settings/quizzes",
}: {
  themeId?: string;
  initial: QuizThemeInput;
  isGlobal?: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Give the theme a name.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        if (themeId) {
          await updateQuizTheme(themeId, { displayName, prompt });
        } else if (isGlobal) {
          await createGlobalQuizTheme({ displayName, prompt });
        } else {
          await createQuizTheme({ displayName, prompt });
        }
        router.push(redirectTo);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the theme.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="displayName" className="text-sm font-medium">
          Display name
        </label>
        <input
          id="displayName"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="e.g. UK Hanging Baskets"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="prompt" className="text-sm font-medium">
          Prompt <span className="font-normal text-muted-foreground">(optional)</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Free text used to filter plants — matches against name, family, habit, soil, position, and more. Leave
          blank to use the display name above as the filter.
        </p>
        <input
          id="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. trees, shade, acid soil — or leave blank"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={isPending}>
        {isPending ? "Saving…" : "Save theme"}
      </Button>
    </form>
  );
}
