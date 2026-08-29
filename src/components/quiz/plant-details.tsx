import type { QuizPlant } from "@/lib/quiz/types";

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}

// why extracted from PlantFlashcard: the favourites gallery (SPEC-028)
// reuses this exact block for its expanded-card view rather than
// duplicating the field list.
export function PlantDetails({ plant }: { plant: QuizPlant }) {
  return (
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
  );
}
