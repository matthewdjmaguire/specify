"use client";

export type RailItemStatus = "correct" | "incorrect" | "skipped" | "unanswered";

export type RailItem = {
  status: RailItemStatus;
  isFollowup: boolean;
};

// why gray covers both "skipped" and "unanswered": per the brief, those two
// are visually the same state to the user ("not yet got an answer down"),
// distinguished only in the underlying data model.
const STATUS_CLASS: Record<RailItemStatus, string> = {
  correct: "bg-success",
  incorrect: "bg-destructive",
  skipped: "bg-muted-foreground/40",
  unanswered: "bg-muted-foreground/40",
};

// why a connected line of stops (not a plain numbered list): this is the
// "tube-map style" progress indicator from the brief — a linear track with
// stations, not a grid, so scanning left-to-right reads as "where am I in
// the run" the same way a subway map does.
export function QuizProgressRail({
  items,
  currentIndex,
  onJump,
}: {
  items: RailItem[];
  currentIndex: number;
  onJump: (index: number) => void;
}) {
  return (
    <div className="w-full max-w-2xl overflow-x-auto">
      <div className="flex items-center gap-0 px-2 py-3" style={{ width: "max-content" }}>
        {items.map((item, i) => (
          <div key={i} className="flex items-center">
            {i > 0 && <div className="h-0.5 w-3 shrink-0 bg-border" />}
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-label={`${item.isFollowup ? "Follow-up" : "Question"} ${i + 1}, ${item.status}`}
              aria-current={i === currentIndex ? "step" : undefined}
              className={`shrink-0 rounded-full transition-all ${STATUS_CLASS[item.status]} ${
                item.isFollowup ? "size-2.5" : "size-3.5"
              } ${i === currentIndex ? "ring-2 ring-ring ring-offset-2 ring-offset-background" : ""}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
