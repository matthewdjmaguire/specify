"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { deleteQuizTheme } from "@/app/actions/quiz-themes";

export function ThemeRow({ id, displayName, prompt }: { id: string; displayName: string; prompt: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      await deleteQuizTheme(id);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div>
        <p className="font-medium">{displayName}</p>
        <p className="text-sm text-muted-foreground">{prompt || "(no filter — matches everything)"}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" render={<Link href={`/settings/quizzes/${id}/edit`}>Edit</Link>} />
        {confirming ? (
          <>
            <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
              {isPending ? "Deleting…" : "Confirm delete"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
      </div>
    </div>
  );
}
