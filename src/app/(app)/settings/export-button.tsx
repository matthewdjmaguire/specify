"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { exportQuizHistory } from "@/app/actions/export";

export function ExportButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    setError(null);
    startTransition(async () => {
      try {
        const csv = await exportQuizHistory();
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `specify-quiz-history-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't export quiz history.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" size="sm" onClick={handleExport} disabled={isPending} className="w-fit">
        {isPending ? "Exporting…" : "Export quiz history (CSV)"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
