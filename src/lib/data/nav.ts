import { createClient } from "@/lib/supabase/server";

export type NavProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

export type NavTheme = {
  id: string;
  displayName: string;
  isLuckyDip: boolean;
};

// why one shared fetch, not one query per component: sidebar, bottom nav,
// and the header all need the same profile/themes data — fetching once in
// the (app) layout and passing it down avoids three separate round trips
// for the same request.
export async function getNavData(): Promise<{ profile: NavProfile | null; themes: NavTheme[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { profile: null, themes: [] };

  const [{ data: profileRow }, { data: themeRows }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, avatar_url, is_admin").eq("id", user.id).single(),
    supabase
      .from("quiz_themes")
      .select("id, display_name, is_lucky_dip")
      .order("is_lucky_dip", { ascending: false })
      .order("display_name"),
  ]);

  return {
    profile: profileRow
      ? {
          id: profileRow.id,
          displayName: profileRow.display_name || user.email || "You",
          avatarUrl: profileRow.avatar_url,
          isAdmin: profileRow.is_admin,
        }
      : null,
    themes: (themeRows ?? []).map((t) => ({
      id: t.id,
      displayName: t.display_name,
      isLuckyDip: t.is_lucky_dip,
    })),
  };
}
