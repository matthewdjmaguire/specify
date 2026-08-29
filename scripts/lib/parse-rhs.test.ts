import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePlantPage } from "./parse-rhs";

function loadFixture(name: string): string {
  return readFileSync(path.join(__dirname, "..", "__fixtures__", name), "utf-8");
}

describe("parsePlantPage", () => {
  it("parses a shrub page (Enkianthus perulatus) with all characteristic fields", () => {
    const html = loadFixture("enkianthus-perulatus.html");
    const record = parsePlantPage(
      html,
      "https://www.rhs.org.uk/plants/6395/enkianthus-perulatus/details",
    );

    expect(record).not.toBeNull();
    expect(record?.scientificName).toBe("Enkianthus perulatus");
    expect(record?.commonName).toBe("white enkianthus");
    expect(record?.synonyms).toEqual(["Enkianthus japonicus"]);
    expect(record?.imageUrl).toMatch(/^https:\/\//);
    expect(record?.family).toBe("Ericaceae");
    expect(record?.genus).toBe("Enkianthus");
    expect(record?.habit).toBe("Bushy");
    expect(record?.foliage).toBe("Deciduous");
    expect(record?.nativeGb).toBe(false);
    expect(record?.soilTypes).toEqual(["Clay", "Loam", "Sand"]);
    expect(record?.moisture).toBe("Moist but well–drained or Well–drained");
    expect(record?.ph).toBe("Acid or Neutral");
    expect(record?.position).toEqual(["Full sun", "Partial shade"]);
    expect(record?.aspect).toBe("East–facing or South–facing or West–facing");
    expect(record?.exposure).toBe("Exposed or Sheltered");
    // why: this is the field a naive `.text()` on <dt> would corrupt — the
    // Hardiness label has a help-modal <dialog> (with a ratings table and a
    // <script>) nested inside it. Asserting an exact "H5" (not a huge blob of
    // modal copy) is what actually catches that bug if it regresses.
    expect(record?.hardiness).toBe("H5");
    expect(record?.heightRange).toBe("1.5-2.5 metres");
    expect(record?.spreadRange).toBe("1.5-2.5 metres");
    expect(record?.geoTags).toEqual(["Global", "UK"]);
  });

  it("parses a tree page (Acer palmatum), including a UK geo tag from hardiness alone", () => {
    const html = loadFixture("acer-palmatum.html");
    const record = parsePlantPage(html, "https://www.rhs.org.uk/plants/225/acer-palmatum/details");

    expect(record).not.toBeNull();
    // why: RHS disambiguates same-name entries with a "[1]" suffix in the taxon
    // name itself — asserting the raw value here (not a cleaned-up guess) so a
    // future "let's strip that suffix" change is a deliberate decision, not a
    // silent regression this test stops noticing.
    expect(record?.scientificName).toBe("Acer palmatum [1]");
    expect(record?.family).toBe("Sapindaceae");
    expect(record?.genus).toBe("Acer");
    expect(record?.soilTypes.length).toBeGreaterThan(0);
    expect(record?.position.length).toBeGreaterThan(0);
    expect(record?.hardiness).toBe("H6");
    expect(record?.nativeGb).toBe(false);
    // why: not native to GB, but H6 ("hardy in all of UK...") should still earn
    // the UK tag on its own — this is the branch the other geoTags test below
    // doesn't cover.
    expect(record?.geoTags).toEqual(["Global", "UK"]);
  });

  it("degrades gracefully on a sparser cultivar page with most fields missing", () => {
    // why: real RHS pages vary a lot in completeness — this cultivar page has
    // no Hardiness/Moisture/Position/Habit data at all. The parser must return
    // nulls/empty-arrays for those, not throw or fabricate values, since
    // SPEC-014 depends on being able to detect "this field has no data" and
    // skip it rather than ask an unanswerable quiz question.
    const html = loadFixture("lavandula-angustifolia-compacta.html");
    const record = parsePlantPage(
      html,
      "https://www.rhs.org.uk/plants/9887/lavandula-angustifolia-compacta/details",
    );

    expect(record).not.toBeNull();
    expect(record?.scientificName).toBe("Lavandula angustifolia 'Compacta'");
    expect(record?.genus).toBe("Lavandula");
    expect(record?.family).toBe("Lamiaceae");
    expect(record?.nativeGb).toBe(false);
    expect(record?.hardiness).toBeNull();
    expect(record?.moisture).toBeNull();
    expect(record?.position).toEqual([]);
    expect(record?.soilTypes).toEqual([]);
    expect(record?.geoTags).toEqual(["Global"]);
  });

  it("returns null for a page with no Taxon JSON-LD (not a plant detail page)", () => {
    const html = "<html><head></head><body>Not a plant page</body></html>";
    expect(parsePlantPage(html, "https://www.rhs.org.uk/plants/search-results")).toBeNull();
  });

  it("marks UK geo tag when native to GB even if hardiness is low", () => {
    const html = `
      <html><head><script type="application/ld+json">
        {"@graph":[{"@type":"Taxon","name":"Testus plantus","image":"https://example.com/a.jpg"}]}
      </script></head><body>
        <dl><div><dt>Native to GB/Ireland</dt><dd>Yes</dd></div>
        <div><dt>Hardiness</dt><dd>H2</dd></div></dl>
      </body></html>`;
    const record = parsePlantPage(html, "https://example.com/plant");
    expect(record?.nativeGb).toBe(true);
    expect(record?.geoTags).toEqual(["Global", "UK"]);
  });

  it("does not tag UK for a tender, non-native plant", () => {
    const html = `
      <html><head><script type="application/ld+json">
        {"@graph":[{"@type":"Taxon","name":"Testus tenderus"}]}
      </script></head><body>
        <dl><div><dt>Native to GB/Ireland</dt><dd>No</dd></div>
        <div><dt>Hardiness</dt><dd>H1B</dd></div></dl>
      </body></html>`;
    const record = parsePlantPage(html, "https://example.com/plant");
    expect(record?.geoTags).toEqual(["Global"]);
  });
});
