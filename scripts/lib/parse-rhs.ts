import * as cheerio from "cheerio";

export type PlantRecord = {
  scientificName: string;
  commonName: string | null;
  synonyms: string[];
  description: string | null;
  imageUrl: string | null;
  source: "rhs" | "bethchatto";
  sourceUrl: string;
  family: string | null;
  genus: string | null;
  habit: string | null;
  // why separate from habit: habit is a growth-*form* descriptor ("Bushy",
  // "Columnar upright") — plantTypes is RHS's own broader classification
  // ("Trees", "Herbaceous Perennial", "Climber", ...), shown on every plant
  // page as `.plant-profile__types .plant-profile__type` badges. A plant can
  // have more than one (e.g. "Climber" + "Wall Shrub").
  plantTypes: string[];
  foliage: string | null;
  nativeGb: boolean | null;
  soilTypes: string[];
  moisture: string | null;
  ph: string | null;
  position: string[];
  aspect: string | null;
  exposure: string | null;
  hardiness: string | null;
  heightRange: string | null;
  spreadRange: string | null;
  geoTags: Array<"UK" | "Global">;
};

type TaxonJsonLd = {
  "@type": string;
  name?: string;
  alternateName?: string[];
  description?: string;
  image?: string;
  parentTaxon?: {
    name?: string;
    taxonRank?: string;
    parentTaxon?: { name?: string; taxonRank?: string };
  };
};

const UK_HARDY_RATINGS = new Set(["H4", "H5", "H6", "H7"]);
const STRIP_SELECTOR = "dialog, button, script, svg, style";

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/gu, " ").trim();
}

// why: RHS's JSON-LD is the one reliable source for scientific name + image on
// every plant page; everything else below is scraped from the visible HTML
// because RHS doesn't expose it any other way.
function extractTaxon($: cheerio.CheerioAPI): TaxonJsonLd | null {
  for (const el of $('script[type="application/ld+json"]').toArray()) {
    let data: unknown;
    try {
      data = JSON.parse($(el).contents().text());
    } catch {
      continue;
    }
    const graph =
      data && typeof data === "object" && "@graph" in data
        ? (data as { "@graph": unknown[] })["@graph"]
        : null;
    if (!Array.isArray(graph)) continue;
    const taxon = graph.find(
      (node): node is TaxonJsonLd =>
        !!node &&
        typeof node === "object" &&
        (node as { "@type"?: string })["@type"] === "Taxon",
    );
    if (taxon) return taxon;
  }
  return null;
}

// why: the "Botanical Details" / "Growing Conditions" sections are rendered as
// <dl><div><dt>Label</dt><dd>Value</dd></div>...</dl>. The Hardiness <dt> has a
// help-modal <dialog> nested inside it (with a full ratings table + a <script>)
// — without stripping those out first, .text() on the <dt> returns the entire
// modal's text instead of just "Hardiness". Cloning + stripping avoids that.
function extractDlFields($: cheerio.CheerioAPI): Record<string, string> {
  const fields: Record<string, string> = {};
  $("dl > div").each((_, row) => {
    const $row = $(row);
    const $dt = $row.find("> dt").first().clone();
    $dt.find(STRIP_SELECTOR).remove();
    const label = collapseWhitespace($dt.text());
    const $dd = $row.find("> dd").first().clone();
    $dd.find(STRIP_SELECTOR).remove();
    const value = collapseWhitespace($dd.text());
    if (label && value) fields[label] = value;
  });
  return fields;
}

// why: Position and Soil Types are rendered as "attribute cards"
// (<div class="card"><h2>Label</h2>...<div class="card__bottom">value</div></div>),
// a different pattern from the dt/dd sections above — RHS shows the selected
// values as plain comma-separated text in .card__bottom.
function extractCardFields($: cheerio.CheerioAPI): Record<string, string> {
  const fields: Record<string, string> = {};
  $(".card").each((_, card) => {
    const $card = $(card);
    const label = collapseWhitespace($card.find("h2").first().text());
    const value = collapseWhitespace($card.find(".card__bottom").first().text());
    if (label && value) fields[label] = value;
  });
  return fields;
}

function extractPlantTypes($: cheerio.CheerioAPI): string[] {
  return $(".plant-profile__types .plant-profile__type")
    .map((_, el) => collapseWhitespace($(el).text()))
    .toArray()
    .filter(Boolean);
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// why: RHS auto-generates this exact boilerplate as the JSON-LD
// `description` for "thin" cultivar pages that have no real editorial
// content — every well-documented page has a genuine botanical description
// in the same field instead, so this is a reliable, cheap way to tell the
// two apart (found by comparing a sparse Camellia cultivar page against a
// known well-documented Acer page — both only differ in whether this exact
// sentence shape is *all* the field contains).
function isGenericDescription(text: string, scientificName: string): boolean {
  return text === `Find help & information on ${scientificName} from the RHS`;
}

export function parsePlantPage(html: string, sourceUrl: string): PlantRecord | null {
  const $ = cheerio.load(html);
  const taxon = extractTaxon($);
  if (!taxon?.name) return null;

  const dlFields = extractDlFields($);
  const cardFields = extractCardFields($);

  const commonName = collapseWhitespace($(".plant-profile__names-text").first().text()) || null;
  const synonymsText = collapseWhitespace($(".plant-profile__synonyms-text").first().text());
  const synonyms = synonymsText ? splitList(synonymsText) : [];

  const hardiness = dlFields["Hardiness"] ?? null;
  const nativeGbRaw = dlFields["Native to GB/Ireland"];
  const nativeGb = nativeGbRaw ? nativeGbRaw.toLowerCase() === "yes" : null;

  const geoTags: Array<"UK" | "Global"> = ["Global"];
  if (nativeGb === true || (hardiness && UK_HARDY_RATINGS.has(hardiness))) {
    geoTags.push("UK");
  }

  const scientificName = taxon.name.trim();
  const rawDescription = taxon.description?.trim() || null;
  const description = rawDescription && !isGenericDescription(rawDescription, scientificName) ? rawDescription : null;

  return {
    scientificName,
    commonName,
    synonyms,
    description,
    imageUrl: taxon.image || null,
    source: "rhs",
    sourceUrl,
    family: dlFields["Family"] ?? taxon.parentTaxon?.parentTaxon?.name ?? null,
    genus: taxon.parentTaxon?.name ?? null,
    habit: dlFields["Habit"] ?? null,
    plantTypes: extractPlantTypes($),
    foliage: dlFields["Foliage"] ?? null,
    nativeGb,
    soilTypes: splitList(cardFields["Soil Types"]),
    moisture: dlFields["Moisture"] ?? null,
    ph: dlFields["pH"] ?? null,
    position: splitList(cardFields["Position"]),
    aspect: dlFields["Aspect"] ?? null,
    exposure: dlFields["Exposure"] ?? null,
    hardiness,
    heightRange: dlFields["Max Height"] ?? null,
    spreadRange: dlFields["Max Spread"] ?? null,
    geoTags,
  };
}
