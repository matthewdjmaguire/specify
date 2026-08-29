import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { summarizeAttempt, type NameQuestionRecord } from "@/lib/quiz/summarize-attempt";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function CategoryList({ title, stats }: { title: string; stats: ReturnType<typeof summarizeAttempt>["strengths"] }) {
  if (stats.length === 0) return null;
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
        {stats.map((s) => (
          <li key={s.category}>
            {s.category} — {Math.round(s.accuracy * 100)}% ({s.correct}/{s.total})
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function QuizSummaryPage({
  params,
}: {
  params: Promise<{ themeId: string; attemptId: string }>;
}) {
  const { attemptId } = await params;
  const supabase = await createClient();

  const { data: attempt } = await supabase
    .from("quiz_attempts")
    .select("id")
    .eq("id", attemptId)
    .single();
  if (!attempt) notFound();

  const { data: questions } = await supabase
    .from("quiz_questions")
    .select("status, plants(habit, family)")
    .eq("attempt_id", attemptId)
    .eq("question_type", "name");

  const records = ((questions ?? []) as unknown as Array<{
    status: NameQuestionRecord["status"];
    plants: { habit: string | null; family: string | null };
  }>).map((q) => ({ status: q.status, plant: q.plants }));

  const summary = summarizeAttempt(records);
  const topFocus = summary.focusAreas[0];
  const createQuizHref = topFocus
    ? `/settings/quizzes/new?displayName=${encodeURIComponent(`${topFocus.category} practice`)}&prompt=${encodeURIComponent(topFocus.category)}`
    : "/settings/quizzes/new";

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Quiz complete</h1>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            {summary.correctCount} / {summary.totalQuestions} correct ({summary.accuracyPercent}%)
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <CategoryList title="Strengths" stats={summary.strengths} />
          <CategoryList title="Focus areas" stats={summary.focusAreas} />
          {summary.strengths.length === 0 && summary.focusAreas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Not enough questions in any one category yet to spot a pattern — keep quizzing.
            </p>
          )}
        </CardContent>
      </Card>
      <div className="flex gap-2">
        <Button variant="outline" render={<Link href="/">Home</Link>} />
        <Button
          render={
            <Link href={createQuizHref}>{topFocus ? `Practice ${topFocus.category}` : "Create a quiz"}</Link>
          }
        />
      </div>
    </div>
  );
}
