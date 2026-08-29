import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ThemeForm } from "../../../settings/quizzes/theme-form";

export default async function NewGlobalThemePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!profile?.is_admin) redirect("/");

  return (
    <div className="flex flex-1 flex-col items-center gap-6 p-8">
      <h1 className="w-full max-w-md text-2xl font-semibold tracking-tight">New global quiz theme</h1>
      <ThemeForm initial={{ displayName: "", prompt: "" }} isGlobal redirectTo="/admin" />
    </div>
  );
}
