import { ThemeForm } from "../theme-form";

// why searchParams, not just a blank form: this is SPEC-016's "Create Quiz"
// deep link target — the quiz summary page links here with
// ?displayName=...&prompt=... pre-filled from the user's weakest category,
// so they can go straight from "here's what to practice" to a running quiz.
export default async function NewQuizThemePage({
  searchParams,
}: {
  searchParams: Promise<{ displayName?: string; prompt?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <h1 className="w-full max-w-md text-2xl font-semibold tracking-tight">New quiz theme</h1>
      <ThemeForm initial={{ displayName: params.displayName ?? "", prompt: params.prompt ?? "" }} />
    </div>
  );
}
