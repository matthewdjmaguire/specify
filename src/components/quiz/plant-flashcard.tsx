import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import type { QuizPlant } from "@/lib/quiz/types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

export type RevealLevel = "hidden" | "name" | "full";

// why revealLevel is three states, not a boolean: per direct feedback, the
// first (name) question only reveals the scientific name on answering —
// the full characteristics card stays hidden until the *second* question
// (the plant's first follow-up) has also been answered. A plain
// revealed:boolean couldn't express the middle state.
export function PlantFlashcard({ plant, revealLevel }: { plant: QuizPlant; revealLevel: RevealLevel }) {
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
      </div>
      {revealLevel !== "hidden" && (
        <CardContent className="flex flex-col gap-3 py-4">
          <div>
            <p className="text-lg font-semibold italic">{plant.scientificName}</p>
            {plant.commonName && <p className="text-sm text-muted-foreground">{plant.commonName}</p>}
          </div>

          {revealLevel === "full" && (
            <>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {plant.family && <Field label="Family" value={plant.family} />}
                {plant.habit && <Field label="Habit" value={plant.habit} />}
                {plant.hardiness && <Field label="Hardiness" value={plant.hardiness} />}
                {plant.heightRange && <Field label="Height" value={plant.heightRange} />}
                {plant.spreadRange && <Field label="Spread" value={plant.spreadRange} />}
                {plant.soilTypes.length > 0 && <Field label="Soil" value={plant.soilTypes.join(", ")} />}
                {plant.position.length > 0 && <Field label="Position" value={plant.position.join(", ")} />}
                {plant.moisture && <Field label="Moisture" value={plant.moisture} />}
              </dl>
              {plant.description && <p className="text-sm text-muted-foreground">{plant.description}</p>}
              {plant.sourceUrl && (
                <a
                  href={plant.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  View on RHS →
                </a>
              )}
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
