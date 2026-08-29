"use client";

export type RailItemStatus = "correct" | "incorrect" | "skipped" | "unanswered";

export type RailItem = {
  status: RailItemStatus;
};

// why gray covers both "skipped" and "unanswered": per the brief, those two
// are visually the same state to the user ("not yet got an answer down"),
// distinguished only in the underlying data model.
const STATUS_CLASS: Record<RailItemStatus, string> = {
  correct: "bg-success",
  incorrect: "bg-destructive",
  skipped: "bg-muted-foreground/30",
  unanswered: "bg-muted-foreground/30",
};

// why one continuous segmented bar, not separate dots-on-a-line: replaces
// the earlier tube-map-of-dots design per direct feedback — still shows
// per-question status (each segment coloured, still clickable to jump), but
// reads as a single progress bar rather than a row of stations.
export function QuizProgressRail({
  items,
  currentIndex,
  onJump,
}: {
  items: RailItem[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  const answered = items.filter((i) => i.status !== "unanswered").length;
  const percent = items.length > 0 ? Math.round((answered / items.length) * 100) : 0;

  return (
    <div className="w-full max-w-2xl">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onJump(i)}
            aria-label={`Question ${i + 1}, ${item.status}`}
            aria-current={i === currentIndex ? "step" : undefined}
            className={`h-full flex-1 border-r border-background/40 transition-opacity last:border-r-0 ${STATUS_CLASS[item.status]} ${
              i === currentIndex ? "opacity-100" : "opacity-80 hover:opacity-100"
            }`}
          />
        ))}
      </div>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {Math.min(currentIndex + 1, items.length)} of {items.length} questions · {percent}% complete
      </p>
    </div>
  );
}
