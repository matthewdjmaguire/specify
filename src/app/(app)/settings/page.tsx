import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";
import { AvatarUpload } from "./avatar-upload";
import { Button } from "@/components/ui/button";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, geo_scope, quiz_length, followup_count")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/sign-in");

  return (
    <div className="flex flex-1 flex-col items-center gap-8 p-8">
      <h1 className="w-full max-w-md text-2xl font-semibold tracking-tight">Settings</h1>

      <div className="w-full max-w-md">
        <AvatarUpload userId={user.id} displayName={profile.display_name} avatarUrl={profile.avatar_url} />
      </div>

      <SettingsForm
        initial={{
          geoScope: profile.geo_scope as "UK" | "Global",
          quizLength: profile.quiz_length as 20 | 50 | 100,
          followupCount: profile.followup_count,
        }}
      />

      <div className="w-full max-w-md border-t pt-6">
        <Button variant="outline" render={<Link href="/settings/quizzes">Manage quiz themes</Link>} />
      </div>
    </div>
  );
}
