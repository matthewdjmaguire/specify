"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type QuizThemeInput = {
  displayName: string;
  prompt: string;
};

// why these actions don't re-check ownership/admin status themselves: RLS
// (SPEC-007) is the real boundary — a personal theme's owner_id is set here
// and enforced by quiz_themes_insert's policy, a non-admin's attempt to
// create/edit a global theme is rejected by the database itself, not by
// this function remembering to check first.

// why a blank prompt defaults to the display name rather than staying
// blank: a blank prompt means "no filter — match every plant in the
// catalogue" (resolveThemePlants treats it the same as Lucky Dip's own
// always-blank prompt), which isn't what someone leaving the field empty
// actually wants — and it was also silently giving every such theme the
// exact same catalogue-wide thumbnail on /quizzes.
function resolvePrompt(input: QuizThemeInput): string {
  return input.prompt.trim() || input.displayName;
}

export async function createQuizTheme(input: QuizThemeInput): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("quiz_themes")
    .insert({
      display_name: input.displayName,
      prompt: resolvePrompt(input),
      owner_id: user.id,
      is_global: false,
    })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/", "layout");
  return data.id as string;
}

export async function updateQuizTheme(id: string, input: QuizThemeInput): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("quiz_themes")
    .update({ display_name: input.displayName, prompt: resolvePrompt(input) })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/", "layout");
}

export async function deleteQuizTheme(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quiz_themes").delete().eq("id", id);
  if (error) {
    // why check the Postgres code, not just rethrow: a theme with existing
    // quiz_attempts now fails on the FK's `on delete restrict` (added after
    // the 2026-08-30 security review found the prior `cascade` let deleting
    // a global theme silently destroy every user's attempts for it) — give
    // a clear message instead of a raw constraint-violation error.
    if (error.code === "23503") {
      throw new Error("This theme has quiz attempts against it and can't be deleted.");
    }
    throw error;
  }

  revalidatePath("/", "layout");
}

// why a dedicated global-theme action, not just createQuizTheme with
// is_global toggled by the caller: keeps the "who's allowed to do this" story
// obvious at the call site (SPEC-021's admin UI calls this one, SPEC-018's
// settings UI calls createQuizTheme) even though RLS enforces it either way.
export async function createGlobalQuizTheme(input: QuizThemeInput): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("quiz_themes")
    .insert({ display_name: input.displayName, prompt: resolvePrompt(input), owner_id: null, is_global: true })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/", "layout");
  return data.id as string;
}
