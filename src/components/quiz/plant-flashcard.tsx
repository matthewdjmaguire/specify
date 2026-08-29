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

// why revealed is a prop, not baked into this component: Learning mode
// always shows characteristics; Intermediate/Hard modes reuse this exact
// card for the image but only reveal the name/characteristics after the
// user answers — one component, one image-rendering implementation
// (hotlinked, per the app's sourcing rules), two behaviours.
export function PlantFlashcard({ plant, revealed }: { plant: QuizPlant; revealed: boolean }) {
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
      {revealed && (
        <CardContent className="flex flex-col gap-3 py-4">
          <div>
            <p className="text-lg font-semibold italic">{plant.scientificName}</p>
            {plant.commonName && <p className="text-sm text-muted-foreground">{plant.commonName}</p>}
          </div>
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
        </CardContent>
      )}
    </Card>
  );
}
