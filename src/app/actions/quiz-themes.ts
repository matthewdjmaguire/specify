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
      prompt: input.prompt,
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
    .update({ display_name: input.displayName, prompt: input.prompt })
    .eq("id", id);
  if (error) throw error;

  revalidatePath("/", "layout");
}

export async function deleteQuizTheme(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("quiz_themes").delete().eq("id", id);
  if (error) throw error;

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
    .insert({ display_name: input.displayName, prompt: input.prompt, owner_id: null, is_global: true })
    .select("id")
    .single();
  if (error) throw error;

  revalidatePath("/", "layout");
  return data.id as string;
}
