"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PlantFlashcard, type RevealLevel } from "@/components/quiz/plant-flashcard";
import { IntermediateQuestion } from "@/components/quiz/intermediate-question";
import { HardQuestion } from "@/components/quiz/hard-question";
import { CharacteristicQuestion } from "@/components/quiz/characteristic-question";
import { QuizProgressRail } from "@/components/quiz/progress-rail";
import { AnswerFeedbackFlash } from "@/components/quiz/answer-feedback-flash";
import { selectDistractors } from "@/lib/quiz/select-distractors";
import { isCloseEnough } from "@/lib/quiz/fuzzy-match";
import { buildFollowupQuestion, type FollowupCategory } from "@/lib/quiz/followup-questions";
import { shuffle } from "@/lib/quiz/random-utils";
import { submitAnswer } from "@/app/actions/quiz-questions";
import { recordPlantMastery } from "@/app/actions/plant-stats";
import { completeQuizAttempt } from "@/app/actions/quiz-attempts";
import type { QuizPlant } from "@/lib/quiz/types";

type QuestionState = {
  questionId: string;
  sequence: number;
  status: "correct" | "incorrect" | "skipped" | "unanswered";
  questionType: string;
  plant: QuizPlant;
  userAnswer: string | null;
};

export function QuizRunner({
  attemptId,
  themeId,
  mode,
  questions: initialQuestions,
  catalogue,
  favouritePlantIds,
  initialIndex = 0,
}: {
  attemptId: string;
  themeId: string;
  mode: "learning" | "intermediate" | "hard";
  questions: Array<{
    questionId: string;
    sequence: number;
    status: QuestionState["status"];
    questionType: string;
    plant: QuizPlant;
  }>;
  catalogue: QuizPlant[];
  favouritePlantIds: string[];
  initialIndex?: number;
}) {
  const router = useRouter();
  const [isFinishing, startFinishing] = useTransition();
  const [index, setIndex] = useState(initialIndex);
  const [questions, setQuestions] = useState<QuestionState[]>(() =>
    initialQuestions.map((q) => ({ ...q, userAnswer: null })),
  );
  const [favouriteIds] = useState(() => new Set(favouritePlantIds));
  // why keyed by questionId, not a plain boolean: prevents the flash from
  // re-triggering when navigating back to an already-answered question —
  // it should only fire the instant an answer is actually recorded.
  const [justAnswered, setJustAnswered] = useState<{ questionId: string; correct: boolean } | null>(null);
  const current = questions[index];
  const isFollowup = current?.questionType.startsWith("characteristic:") ?? false;
  const followupCategory = isFollowup
    ? (current.questionType.split(":")[1] as FollowupCategory)
    : null;

  // why a wrapper around setIndex, not a useEffect keyed on index: an
  // effect that clears justAnswered on every index change works, but
  // triggers React's "avoid setState directly in an effect" lint rule —
  // clearing it at the same call site that changes the index is equivalent
  // and doesn't need an effect at all.
  function goToIndex(next: number) {
    setJustAnswered(null);
    setIndex(next);
  }

  // why grouped by plant, not just looking at `current`: the two-stage
  // reveal (name only after the ID question, full card only after the
  // *next* question for that same plant) needs to know the status of the
  // plant's other questions, not just the one currently on screen — e.g.
  // viewing a follow-up needs to know whether the ID question before it was
  // answered, and viewing the ID question needs to know whether a later
  // follow-up has already been answered (if the user jumped ahead via the
  // rail and then back).
  const revealLevel: RevealLevel = useMemo(() => {
    if (!current) return "hidden";
    if (mode === "learning") return "full";
    const group = questions.filter((q) => q.plant.id === current.plant.id);
    const idAnswered = group[0]?.status !== "unanswered";
    if (!idAnswered) return "hidden";
    // why group.length <= 1 counts as "satisfied": a plant with no
    // follow-up questions at all (followup_count=0, or this plant had no
    // populated categories) has no "second question" to wait for — reveal
    // the full card right after the ID question instead of never.
    const secondAnswered = group.length <= 1 || group[1]?.status !== "unanswered";
    return secondAnswered ? "full" : "name";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.plant.id, questions, mode]);

  // why useMemo keyed on questionId (not state): options/questions must stay
  // stable across back/forward navigation within one attempt — revisiting an
  // already-answered question shouldn't reshuffle its choices. useMemo
  // achieves that for free as long as the component instance persists (it
  // does; only `index` changes).
  const intermediateOptions = useMemo(() => {
    if (mode !== "intermediate" || isFollowup || !current) return [];
    return shuffle([current.plant, ...selectDistractors(current.plant, catalogue, 3)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.questionId, mode, isFollowup]);

  const followupQuestion = useMemo(() => {
    if (!isFollowup || !current || !followupCategory) return null;
    return buildFollowupQuestion(current.plant, followupCategory, catalogue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.questionId, isFollowup, followupCategory]);

  if (!current) {
    return <p className="p-8 text-center text-muted-foreground">This quiz has no questions.</p>;
  }

  async function recordAnswer(value: string, isCorrect: boolean) {
    const status = isCorrect ? "correct" : "incorrect";
    setQuestions((prev) =>
      prev.map((q) => (q.questionId === current.questionId ? { ...q, status, userAnswer: value } : q)),
    );
    setJustAnswered({ questionId: current.questionId, correct: isCorrect });
    // why plant_stats only updates for the name question, not follow-ups:
    // priority_weight (SPEC-010's selection input) is about "recognise this
    // plant by name" specifically — see plant-stats.ts's own comment.
    await Promise.all([
      submitAnswer(current.questionId, status, value),
      isFollowup ? Promise.resolve() : recordPlantMastery(current.plant.id, isCorrect),
    ]);
  }

  async function handleIntermediateAnswer(option: QuizPlant) {
    await recordAnswer(option.scientificName, option.id === current.plant.id);
  }

  async function handleHardAnswer(value: string) {
    await recordAnswer(value, isCloseEnough(value, current.plant.scientificName));
  }

  async function handleFollowupAnswer(value: string) {
    if (!followupQuestion) return;
    await recordAnswer(value, value === followupQuestion.correctValue);
  }

  const answeredIntermediateOption = intermediateOptions.find((o) => o.scientificName === current.userAnswer);
  const isLastQuestion = index === questions.length - 1;

  function handleFinish() {
    startFinishing(async () => {
      await completeQuizAttempt(attemptId);
      // why no summary for Learning mode: nothing is ever answered/scored in
      // Learning mode (it's a flashcard deck, not a test) — the summary page
      // would always show "0/0 correct", which isn't useful. Send them back
      // to mode-select instead.
      router.push(mode === "learning" ? `/quiz/${themeId}` : `/quiz/${themeId}/${attemptId}/summary`);
    });
  }

  return (
    <div className="relative flex flex-1 flex-col items-center gap-3 p-4">
      {/* why absolutely positioned rather than its own row: a fixed-height
          question needs to fit an iPhone 15 screen without scrolling — a
          full-width row just for Exit was one row too many. */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="absolute top-2 right-2 z-10"
        aria-label="Exit quiz"
        render={
          <Link href={`/quiz/${themeId}`}>
            <X className="size-4" />
          </Link>
        }
      />

      <QuizProgressRail
        items={questions.map((q) => ({ status: q.status }))}
        currentIndex={index}
        onJump={goToIndex}
      />

      <div className="relative w-full max-w-md">
        <PlantFlashcard
          key={current.plant.id}
          plant={current.plant}
          revealLevel={revealLevel}
          isFavourite={favouriteIds.has(current.plant.id)}
        />
        {justAnswered?.questionId === current.questionId && <AnswerFeedbackFlash isCorrect={justAnswered.correct} />}
      </div>

      {isFollowup && followupQuestion && (
        <CharacteristicQuestion
          question={followupQuestion}
          answeredValue={current.userAnswer}
          onSelect={handleFollowupAnswer}
        />
      )}

      {!isFollowup && mode === "intermediate" && (
        <IntermediateQuestion
          correctPlantId={current.plant.id}
          options={intermediateOptions}
          answeredId={answeredIntermediateOption?.id ?? null}
          onSelect={handleIntermediateAnswer}
        />
      )}

      {!isFollowup && mode === "hard" && (
        <HardQuestion
          key={current.questionId}
          answered={current.status !== "unanswered"}
          isCorrect={current.status === "correct"}
          previousAnswer={current.userAnswer}
          onSubmit={handleHardAnswer}
        />
      )}

      <div className="flex gap-2">
        <Button
          variant="outline"
          data-testid="quiz-back"
          onClick={() => goToIndex(Math.max(0, index - 1))}
          disabled={index === 0}
        >
          Back
        </Button>
        {isLastQuestion ? (
          <Button data-testid="quiz-finish" onClick={handleFinish} disabled={isFinishing}>
            {isFinishing ? "Finishing…" : "Finish"}
          </Button>
        ) : (
          <Button data-testid="quiz-next" onClick={() => goToIndex(Math.min(questions.length - 1, index + 1))}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
