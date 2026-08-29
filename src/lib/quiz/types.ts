export type QuizPlant = {
  id: string;
  scientificName: string;
  commonName: string | null;
  description: string | null;
  imageUrl: string | null;
  // why kept even though the quiz UI never needs to identify the source
  // site by name: it's the one link back to RHS's own page for this plant,
  // shown on the flashcard per the app's "always credit the source" rule.
  sourceUrl: string | null;
  family: string | null;
  genus: string | null;
  habit: string | null;
  foliage: string | null;
  soilTypes: string[];
  moisture: string | null;
  ph: string | null;
  position: string[];
  aspect: string | null;
  exposure: string | null;
  hardiness: string | null;
  heightRange: string | null;
  spreadRange: string | null;
};
