import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFavouritedPlants, getOrCreateFavouritesTheme } from "@/app/actions/favourites";
import { Button } from "@/components/ui/button";
import { FavouritesView } from "./favourites-view";

export default async function FavouritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const plants = await getFavouritedPlants();
  // why only when there are favourites: this lazily creates the personal
  // "My Favourites" theme quiz_attempts needs to reference — no point
  // provisioning it for a user who has nothing to quiz on yet.
  const favouritesThemeId = plants.length > 0 ? await getOrCreateFavouritesTheme() : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Favourites</h1>
        {favouritesThemeId && (
          <Button render={<Link href={`/quiz/${favouritesThemeId}`}>Quiz me on my Favourites</Link>} />
        )}
      </div>
      <FavouritesView plants={plants} />
    </div>
  );
}
