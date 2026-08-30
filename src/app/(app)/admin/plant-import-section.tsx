"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createImportJob, processNextImportJobTick, type ImportJob } from "@/app/actions/plant-import";

const TICK_PAUSE_MS = 1500;

const STATUS_LABEL: Record<ImportJob["status"], string> = {
  pending: "Queued",
  running: "Running",
  done: "Done",
  failed: "Failed",
};

function JobRow({ job }: { job: ImportJob }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3 text-sm">
      <div>
        <p className="font-medium">{job.genus}</p>
        <p className="text-muted-foreground">
          {job.importedCount}/{job.targetCount} imported · {job.fetchedCount} pages fetched
        </p>
        {job.errorMessage && <p className="text-destructive">{job.errorMessage}</p>}
      </div>
      <span
        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
          job.status === "done"
            ? "bg-success/10 text-success"
            : job.status === "failed"
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-muted-foreground"
        }`}
      >
        {STATUS_LABEL[job.status]}
      </span>
    </div>
  );
}

export function PlantImportSection({ initialJobs }: { initialJobs: ImportJob[] }) {
  const router = useRouter();
  const [genus, setGenus] = useState("");
  const [targetCount, setTargetCount] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const hasActiveJob = initialJobs.some((j) => j.status === "pending" || j.status === "running");

  // why this page drives ticks itself, not a Vercel Cron job: per-minute
  // cron schedules need a paid plan tier this project doesn't have — a
  // sequential await-loop while the admin has the page open turns out
  // faster anyway (seconds apart, not once a minute). It stops as soon as
  // hasActiveJob goes false (derived fresh from props on every
  // router.refresh() below), and the cancelled flag stops a stray tick from
  // landing after unmount.
  useEffect(() => {
    if (!hasActiveJob) return;
    let cancelled = false;

    async function loop() {
      while (!cancelled) {
        try {
          await processNextImportJobTick();
        } catch {
          // surfaced via the job's own error_message once refreshed below
        }
        if (cancelled) return;
        router.refresh();
        await new Promise((resolve) => setTimeout(resolve, TICK_PAUSE_MS));
      }
    }

    loop();
    return () => {
      cancelled = true;
    };
  }, [hasActiveJob, router]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await createImportJob(genus, targetCount);
        setGenus("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't start the import.");
      }
    });
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-3">
      <h2 className="text-lg font-medium">Plant catalogue</h2>
      <p className="text-xs text-muted-foreground">
        Imports run a few pages at a time (respecting RHS&apos;s request rate) while this page stays open — a job may
        take a minute or two to finish. Capped at 100 plants per job by design; this tops up the curated seed set,
        not a general-purpose crawler.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="genus" className="text-xs font-medium">
            RHS genus slug
          </label>
          <input
            id="genus"
            value={genus}
            onChange={(e) => setGenus(e.target.value)}
            placeholder="e.g. camellia"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="targetCount" className="text-xs font-medium">
            Plants to add
          </label>
          <input
            id="targetCount"
            type="number"
            min={1}
            max={100}
            value={targetCount}
            onChange={(e) => setTargetCount(Number(e.target.value))}
            className="w-24 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" disabled={isPending || !genus.trim()}>
          {isPending ? "Starting…" : "Start import"}
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}

      {initialJobs.length > 0 && (
        <div className="flex flex-col gap-2">
          {initialJobs.map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </div>
      )}
    </section>
  );
}
