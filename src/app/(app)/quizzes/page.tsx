import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";
import { filterPlantsByPrompt, PLANT_COLUMNS, toQuizPlant, type PlantRow } from "@/lib/quiz/resolve-theme-plants";
import type { QuizPlant } from "@/lib/quiz/types";

export default async function QuizzesPage() {
  const supabase = await createClient();

  const [{ data: themeRows }, { data: plantRows }] = await Promise.all([
    supabase
      .from("quiz_themes")
      .select("id, display_name, prompt, is_lucky_dip")
      .order("is_lucky_dip", { ascending: false })
      .order("display_name"),
    // why fetched once, not once per theme: the thumbnail/count for every
    // theme card comes from the same catalogue, filtered client-side per
    // theme's prompt (SPEC-009's filterPlantsByPrompt) rather than issuing
    // one DB round trip per theme.
    supabase.from("plants").select(PLANT_COLUMNS),
  ]);

  const allPlants = ((plantRows ?? []) as PlantRow[]).map(toQuizPlant);
  const themes = (themeRows ?? []).map((theme) => {
    const matched = theme.is_lucky_dip ? allPlants : filterPlantsByPrompt(allPlants, theme.prompt);
    const thumbnail = matched.find((p: QuizPlant) => p.imageUrl) ?? null;
    return { ...theme, plantCount: matched.length, thumbnail };
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Quizzes</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {themes.map((theme) => (
          <Link key={theme.id} href={`/quiz/${theme.id}`}>
            <Card className="h-full gap-0 overflow-hidden py-0 transition-shadow hover:shadow-md">
              <div className="relative aspect-video w-full bg-muted">
                {theme.thumbnail?.imageUrl ? (
                  <Image src={theme.thumbnail.imageUrl} alt="" fill unoptimized className="object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    No plants yet
                  </div>
                )}
              </div>
              <CardContent className="flex flex-col gap-1 py-4">
                <p className="font-medium">{theme.display_name}</p>
                <p className="text-sm text-muted-foreground">
                  {theme.plantCount} plant{theme.plantCount === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
