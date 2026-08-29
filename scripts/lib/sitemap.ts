const SITEMAP_URLS = [1, 2, 3, 4, 5, 6, 7].map(
  (n) => `https://www.rhs.org.uk/sitemap-plants-${n}.xml`,
);

export type SitemapEntry = { url: string; slug: string };

async function fetchSitemap(url: string): Promise<string[]> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`Failed to fetch sitemap ${url}: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

// why: RHS's plant sitemaps list ~306k URLs across 7 files — we always need
// the full list once per run so we can match genus prefixes against it, but
// callers should fetch this once and reuse it rather than re-fetching per genus.
export async function fetchAllPlantUrls(): Promise<SitemapEntry[]> {
  const entries: SitemapEntry[] = [];
  for (const sitemapUrl of SITEMAP_URLS) {
    const urls = await fetchSitemap(sitemapUrl);
    for (const url of urls) {
      const match = url.match(/\/plants\/\d+\/([a-z0-9-]+)\/details$/);
      if (match) entries.push({ url, slug: match[1] });
    }
  }
  return entries;
}

// why: a plant's slug is "{genus}-{species-and-cultivar}" — matching on
// "{genus}-" (not a bare equals) both requires a species part (skips pure
// genus-overview pages, which tend to have sparse characteristic data) and
// avoids accidental prefix collisions between unrelated genera.
export function urlsForGenus(entries: SitemapEntry[], genus: string): string[] {
  const prefix = `${genus}-`;
  return entries.filter((e) => e.slug.startsWith(prefix)).map((e) => e.url);
}
