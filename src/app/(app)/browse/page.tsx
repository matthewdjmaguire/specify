import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAllPlants } from "@/app/actions/plants";
import { getFavouritePlantIds } from "@/app/actions/favourites";
import { BrowseView } from "./browse-view";

export default async function BrowsePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const [plants, favouritePlantIds] = await Promise.all([getAllPlants(), getFavouritePlantIds()]);

  return (
    <div className="flex flex-1 flex-col gap-6 p-6 md:p-8">
      <h1 className="text-2xl font-semibold tracking-tight">Browse</h1>
      <BrowseView plants={plants} favouritePlantIds={favouritePlantIds} />
    </div>
  );
}
