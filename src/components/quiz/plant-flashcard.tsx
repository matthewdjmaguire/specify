import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { FavouriteButton } from "./favourite-button";
import { PlantDetails } from "./plant-details";
import type { QuizPlant } from "@/lib/quiz/types";

export type RevealLevel = "hidden" | "name" | "full";

// why revealLevel is three states, not a boolean: per direct feedback, the
// first (name) question only reveals the scientific name on answering —
// the full characteristics card stays hidden until the *second* question
// (the plant's first follow-up) has also been answered. A plain
// revealed:boolean couldn't express the middle state.
export function PlantFlashcard({
  plant,
  revealLevel,
  isFavourite,
}: {
  plant: QuizPlant;
  revealLevel: RevealLevel;
  // why optional: this component is also used in the favourites gallery,
  // which does its own favourite-toggle button placement (a whole card is
  // clickable to expand/collapse there) rather than the quiz flow's fixed
  // corner button.
  isFavourite?: boolean;
}) {
  return (
    <Card className="w-full max-w-md overflow-hidden gap-0 py-0">
      <div className="relative aspect-4/3 w-full bg-muted">
        {plant.imageUrl ? (
          // why unoptimized: this renders the RHS image URL directly with no
          // Vercel image-optimization proxying/caching — a genuine hotlink,
          // per the app's "never mirror source images" decision.
          <Image src={plant.imageUrl} alt="" fill unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No image available
          </div>
        )}
        {revealLevel !== "hidden" && isFavourite !== undefined && (
          <FavouriteButton
            plantId={plant.id}
            initialIsFavourite={isFavourite}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
          />
        )}
      </div>
      {revealLevel !== "hidden" && (
        <CardContent className="flex flex-col gap-3 py-4">
          <div>
            <p className="text-lg font-semibold italic">{plant.scientificName}</p>
            {plant.commonName && <p className="text-sm text-muted-foreground">{plant.commonName}</p>}
          </div>

          {revealLevel === "full" && <PlantDetails plant={plant} />}
        </CardContent>
      )}
    </Card>
  );
}
