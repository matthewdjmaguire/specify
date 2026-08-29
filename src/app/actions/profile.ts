"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ProfileSettingsInput = {
  geoScope: "UK" | "Global";
  quizLength: 20 | 50 | 100;
  followupCount: number;
};

// why this doesn't re-check is_admin/is_allowed itself: those columns
// aren't even part of this input — the profiles_guard DB trigger (SPEC-004)
// is the actual enforcement that a client can never touch them, regardless
// of what any server action does or doesn't check.
export async function updateProfileSettings(input: ProfileSettingsInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase
    .from("profiles")
    .update({
      geo_scope: input.geoScope,
      quiz_length: input.quizLength,
      followup_count: input.followupCount,
    })
    .eq("id", user.id);
  if (error) throw error;

  revalidatePath("/", "layout");
}

export async function updateAvatarUrl(avatarUrl: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);
  if (error) throw error;

  revalidatePath("/", "layout");
}
