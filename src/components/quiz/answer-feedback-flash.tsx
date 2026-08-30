import { Check, X } from "lucide-react";

// why an overlay rendered/unrendered by the parent (keyed on questionId),
// not an internal timer here: the parent already knows exactly when an
// answer was just recorded vs. when the same question is simply being
// revisited — re-deriving that here would need the same state twice.
// tw-animate-css's animate-out utilities (already a dependency) drive the
// actual "wipe upward and disappear" motion; fill-mode-forwards keeps it
// invisible at rest instead of snapping back after the animation ends.
export function AnswerFeedbackFlash({ isCorrect }: { isCorrect: boolean }) {
  const Icon = isCorrect ? Check : X;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center overflow-hidden rounded-lg">
      <div
        className={`animate-out fade-out slide-out-to-top-12 duration-700 ease-out fill-mode-forwards rounded-full p-6 ${
          isCorrect ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
        }`}
      >
        <Icon className="size-16" strokeWidth={3} />
      </div>
    </div>
  );
}
