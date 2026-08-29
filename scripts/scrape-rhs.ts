// SPEC-001: scrapes a curated cross-section of RHS plant pages into a seed
// dataset for the `plants` table (built in SPEC-006). Run with:
//   npx tsx scripts/scrape-rhs.ts
//
// why curated, not the full ~306k-page catalogue: a defensible cross-section
// of common garden plants is what the app actually needs for v1, and crawling
// the full site would be both slow and a much heavier load on RHS's site than
// this app's use case justifies (see CLAUDE.md's data-sourcing notes).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { GENUS_CATEGORIES } from "./lib/genus-list";
import { parsePlantPage, type PlantRecord } from "./lib/parse-rhs";
import { fetchAllPlantUrls, urlsForGenus, type SitemapEntry } from "./lib/sitemap";

const PER_GENUS_CAP = 25;
const TARGET_COUNT = 300;
const REQUEST_DELAY_MS = 350;
const CACHE_DIR = path.join(__dirname, ".cache");
const SITEMAP_CACHE_FILE = path.join(CACHE_DIR, "sitemap-urls.json");
const OUTPUT_FILE = path.join(__dirname, "seed", "plants-seed.json");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// why: deterministic (seeded) shuffle, not Math.random — re-running the
// script picks the same sample rather than a different random subset each
// time, which makes seed output diffable and reruns idempotent-ish.
function seededShuffle<T>(items: T[], seed: string): T[] {
  let state = [...seed].reduce((acc, c) => acc + c.charCodeAt(0), 7);
  const next = () => {
    state = (state * 48271) % 2147483647;
    return state / 2147483647;
  };
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// why: a first pass sampling randomly within each genus landed mostly on
// obscure named cultivars ("Acer carpinifolium 'Esveld Select'") — RHS has
// far more of those than base-species pages, but they're much more likely to
// be stub pages (measured: only 16% had an image, 24% had position/soil
// data). Plain species slugs ("acer-palmatum", two hyphens or fewer) are
// RHS's flagship entries and are far more likely to be fully documented, so
// rank those first; cultivar-heavy slugs (more hyphens) fill in only if a
// genus doesn't have enough plain-species candidates.
function preferPlainSpecies(urls: string[], genus: string): string[] {
  const hyphenCount = (url: string) => url.split("/").at(-2)!.split("-").length;
  return seededShuffle(urls, genus).sort((a, b) => hyphenCount(a) - hyphenCount(b));
}

async function loadSitemapEntries(): Promise<SitemapEntry[]> {
  try {
    const cached = await readFile(SITEMAP_CACHE_FILE, "utf-8");
    console.log("Using cached sitemap URL list.");
    return JSON.parse(cached) as SitemapEntry[];
  } catch {
    console.log("Fetching RHS plant sitemaps (7 files, ~306k URLs)...");
    const entries = await fetchAllPlantUrls();
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(SITEMAP_CACHE_FILE, JSON.stringify(entries));
    return entries;
  }
}

async function fetchAndParse(url: string): Promise<PlantRecord | null> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) {
      console.warn(`  skip ${url}: HTTP ${res.status}`);
      return null;
    }
    const html = await res.text();
    return parsePlantPage(html, url);
  } catch (err) {
    console.warn(`  skip ${url}: ${(err as Error).message}`);
    return null;
  }
}

async function main() {
  const entries = await loadSitemapEntries();
  const seen = new Set<string>();
  const results: PlantRecord[] = [];

  categoryLoop: for (const [category, genera] of Object.entries(GENUS_CATEGORIES)) {
    console.log(`\n=== ${category} ===`);
    for (const genus of genera) {
      const candidates = preferPlainSpecies(urlsForGenus(entries, genus), genus).slice(
        0,
        PER_GENUS_CAP,
      );
      if (candidates.length === 0) {
        console.warn(`  ${genus}: no sitemap matches`);
        continue;
      }
      let acceptedForGenus = 0;
      for (const url of candidates) {
        if (acceptedForGenus >= 5) break; // enough diversity from one genus
        await sleep(REQUEST_DELAY_MS);
        const record = await fetchAndParse(url);
        if (!record) continue;
        if (seen.has(record.scientificName)) continue;
        // why: a record with no image can't power the flashcard/quiz image
        // requirement at all — skip it rather than seed a plant nothing can
        // ever quiz on. Description-only stub pages are common among obscure
        // cultivars (see the comment on preferPlainSpecies).
        if (!record.imageUrl) continue;
        seen.add(record.scientificName);
        results.push(record);
        acceptedForGenus++;
        console.log(`  ✓ ${record.scientificName} (${category})`);
        if (results.length >= TARGET_COUNT) break categoryLoop;
      }
    }
  }

  await mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} plants to ${path.relative(process.cwd(), OUTPUT_FILE)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
