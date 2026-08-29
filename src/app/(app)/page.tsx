import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { summarizeAttempt, type NameQuestionRecord } from "@/lib/quiz/summarize-attempt";
import { mostCommonCategories, weeklyAccuracyTrend, type DatedNameQuestionRecord } from "@/lib/quiz/homepage-stats";
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

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [{ count: attemptsCount }, { data: questions }] = await Promise.all([
    supabase
      .from("quiz_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .not("completed_at", "is", null),
    supabase.from("quiz_questions").select("status, created_at, plants(habit, family)").eq("question_type", "name"),
  ]);

  const records = ((questions ?? []) as unknown as Array<{
    status: NameQuestionRecord["status"];
    created_at: string;
    plants: { habit: string | null; family: string | null };
  }>).map((q) => ({ status: q.status, plant: q.plants, createdAt: q.created_at }));

  const summary = summarizeAttempt(records);
  const topCategories = mostCommonCategories(records);
  const trend = weeklyAccuracyTrend(records as DatedNameQuestionRecord[]);
  const hasHistory = summary.totalQuestions > 0;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>

      {!hasHistory ? (
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>No quizzes yet</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Run your first quiz and your stats — strengths, focus areas, and trends — will show up here.
            </p>
            <Button render={<Link href="/quizzes">Browse quizzes</Link>} className="w-fit" />
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {attemptsCount ?? 0} {attemptsCount === 1 ? "quiz" : "quizzes"} completed
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {summary.correctCount} / {summary.totalQuestions} plants correctly identified overall (
                {summary.accuracyPercent}%)
                {trend && (
                  <span className={trend.direction === "down" ? "text-destructive" : "text-success"}>
                    {" "}
                    — {trend.currentAccuracyPercent}%{" "}
                    {trend.direction === "up" ? "↑" : trend.direction === "down" ? "↓" : "→"} this week
                  </span>
                )}
              </p>
              <CategoryList title="Strengths" stats={summary.strengths} />
              <CategoryList title="Focus areas" stats={summary.focusAreas} />
            </CardContent>
          </Card>

          {topCategories.length > 0 && (
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Most quizzed types</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-0.5 text-sm text-muted-foreground">
                  {topCategories.map((c) => (
                    <li key={c.category}>
                      {c.category} — {c.total} question{c.total === 1 ? "" : "s"}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
