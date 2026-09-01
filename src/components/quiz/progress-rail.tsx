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
  percentMode = "answered",
}: {
  items: RailItem[];
  currentIndex: number;
  onJump: (index: number) => void;
  // why a mode flag, not always deriving from item status: "answered"
  // means "% complete" tracks score progress, which only means something in
  // scored modes (Intermediate/Hard) — every question in Learning mode
  // stays "unanswered" forever by design (nothing is ever scored there, see
  // quiz-runner's revealLevel/handleFinish comments), which pinned this at
  // a permanent 0% instead of moving as the user pages through the deck.
  // "position" tracks how far through the deck currentIndex has reached
  // instead, which is the only definition of "complete" that makes sense
  // for an unscored flashcard mode.
  percentMode?: "answered" | "position";
}) {
  const answered = items.filter((i) => i.status !== "unanswered").length;
  const percent =
    items.length === 0
      ? 0
      : percentMode === "position"
        ? Math.round(((currentIndex + 1) / items.length) * 100)
        : Math.round((answered / items.length) * 100);

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
