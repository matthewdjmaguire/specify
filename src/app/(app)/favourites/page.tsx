import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getFavouritedPlants } from "@/app/actions/favourites";
import { FavouritesView } from "./favourites-view";

export default async function FavouritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const plants = await getFavouritedPlants();

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Favourites</h1>
      <FavouritesView plants={plants} />
    </div>
  );
}
