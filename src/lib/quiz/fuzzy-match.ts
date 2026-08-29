// why optimal-string-alignment distance, not plain Levenshtein: plain
// Levenshtein has no single-edit transposition — swapping two adjacent
// letters ("plamatum" for "palmatum") costs 2 (two substitutions), which
// fails the ticket's explicit requirement to forgive transpositions,
// especially on short names where a 20%-scaled threshold rounds down to 1.
// Adding the one extra transposition rule (OSA variant, not full
// Damerau-Levenshtein) fixes exactly that case for a few extra lines.
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i][0] = i;
  for (let j = 0; j < cols; j++) dp[0][j] = j;

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[rows - 1][cols - 1];
}

// why strip "[1]"-style suffixes: RHS disambiguates same-named entries with
// a bracketed index (e.g. "Acer palmatum [1]") — an artifact of their own
// catalogue, not real botanical nomenclature. Asking a learner to type that
// exactly would be testing trivia about RHS's site, not plant names.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\[\d+\]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// why edit-distance with a length-scaled (not fixed) threshold: a fixed
// tolerance (e.g. "2 chars") is too strict for long names and too generous
// for short ones. Scaling to ~20% of the longer string's length, with a
// floor of 1, forgives realistic typos ("Hemerocalis" for "Hemerocallis")
// on both short and long names without accepting a genuinely different
// plant of similar length.
export function isCloseEnough(userInput: string, scientificName: string): boolean {
  const a = normalize(userInput);
  const b = normalize(scientificName);
  if (!a || !b) return false;
  if (a === b) return true;

  const maxLen = Math.max(a.length, b.length);
  const threshold = Math.max(1, Math.round(maxLen * 0.2));
  return editDistance(a, b) <= threshold;
}
