"use client";

import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { PlantCard } from "@/components/quiz/plant-card";
import type { QuizPlant } from "@/lib/quiz/types";

function letterOf(plant: QuizPlant): string {
  return plant.scientificName.charAt(0).toUpperCase();
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function LetterSection({
  letter,
  plants,
  expanded,
  onToggle,
  showThumbnails,
  favouriteIds,
  expandedPlantIds,
  onTogglePlant,
  onFavouriteChange,
}: {
  letter: string;
  plants: QuizPlant[];
  expanded: boolean;
  onToggle: () => void;
  showThumbnails: boolean;
  favouriteIds: Set<string>;
  expandedPlantIds: Set<string>;
  onTogglePlant: (id: string) => void;
  onFavouriteChange: (id: string, next: boolean) => void;
}) {
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  }

  return (
    <section>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={handleKeyDown}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 border-b py-2 text-left"
      >
        <ChevronRight className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`} />
        <h2 className="text-lg font-semibold">{letter}</h2>
        <span className="text-sm text-muted-foreground">({plants.length})</span>
      </div>
      {expanded &&
        (showThumbnails ? (
          <div className="grid grid-cols-1 gap-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
            {plants.map((plant) => (
              <PlantCard
                key={plant.id}
                plant={plant}
                isFavourite={favouriteIds.has(plant.id)}
                showThumbnail
                expanded={expandedPlantIds.has(plant.id)}
                onToggleExpand={() => onTogglePlant(plant.id)}
                onFavouriteChange={(next) => onFavouriteChange(plant.id, next)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border">
            {plants.map((plant) => (
              <div key={plant.id} className="px-3">
                <PlantCard
                  plant={plant}
                  isFavourite={favouriteIds.has(plant.id)}
                  showThumbnail={false}
                  expanded={expandedPlantIds.has(plant.id)}
                  onToggleExpand={() => onTogglePlant(plant.id)}
                  onFavouriteChange={(next) => onFavouriteChange(plant.id, next)}
                />
              </div>
            ))}
          </div>
        ))}
    </section>
  );
}

export function BrowseView({
  plants,
  favouritePlantIds,
}: {
  plants: QuizPlant[];
  favouritePlantIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [geoFilter, setGeoFilter] = useState<"" | "UK" | "Global">("");
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [favouriteIds, setFavouriteIds] = useState(() => new Set(favouritePlantIds));
  // why "A" only, not every letter: the ask was specifically "all but A
  // collapsed by default" — a full alphabet of expanded sections on first
  // load would defeat the point of grouping at all.
  const [expandedLetters, setExpandedLetters] = useState<Set<string>>(() => new Set(["A"]));
  const [expandedPlantIds, setExpandedPlantIds] = useState<Set<string>>(new Set());

  const typeOptions = useMemo(() => uniqueSorted(plants.flatMap((p) => p.plantTypes)), [plants]);
  const positionOptions = useMemo(() => uniqueSorted(plants.flatMap((p) => p.position)), [plants]);

  const filteredPlants = useMemo(() => {
    const term = query.trim().toLowerCase();
    return plants.filter((p) => {
      if (term) {
        const haystack = `${p.scientificName} ${p.commonName ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (typeFilter && !p.plantTypes.includes(typeFilter)) return false;
      if (positionFilter && !p.position.includes(positionFilter)) return false;
      if (geoFilter && !p.geoTags.includes(geoFilter)) return false;
      return true;
    });
  }, [plants, query, typeFilter, positionFilter, geoFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, QuizPlant[]>();
    for (const plant of filteredPlants) {
      const letter = letterOf(plant);
      const bucket = map.get(letter);
      if (bucket) bucket.push(plant);
      else map.set(letter, [plant]);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPlants]);

  // why any active filter, not just text search: a collapsed letter section
  // would otherwise hide a match for "Trees" or "UK" the same way it would
  // for a typed search term.
  const isSearching = query.trim().length > 0 || typeFilter !== "" || positionFilter !== "" || geoFilter !== "";

  function toggleLetter(letter: string) {
    setExpandedLetters((prev) => {
      const next = new Set(prev);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  }

  function expandAll() {
    setExpandedLetters(new Set(groups.map(([letter]) => letter)));
  }

  function collapseAll() {
    setExpandedLetters(new Set());
  }

  function togglePlant(id: string) {
    setExpandedPlantIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleFavouriteChange(id: string, next: boolean) {
    setFavouriteIds((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });
  }

  if (plants.length === 0) {
    return <p className="text-sm text-muted-foreground">No plants in the catalogue yet.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <button type="button" onClick={expandAll} className="text-primary underline-offset-2 hover:underline">
          Expand all
        </button>
        <button type="button" onClick={collapseAll} className="text-primary underline-offset-2 hover:underline">
          Collapse all
        </button>
        <label className="ml-auto flex items-center gap-2">
          <span className="text-muted-foreground">Thumbnails</span>
          <button
            type="button"
            role="switch"
            aria-checked={showThumbnails}
            onClick={() => setShowThumbnails((v) => !v)}
            className={`relative h-5 w-9 rounded-full transition-colors ${
              showThumbnails ? "bg-primary" : "bg-muted"
            }`}
          >
            <span
              className={`absolute top-0.5 size-4 rounded-full bg-background transition-transform ${
                showThumbnails ? "translate-x-4.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plants…"
          aria-label="Search plants"
          className="flex-1 basis-48 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          value={geoFilter}
          onChange={(e) => setGeoFilter(e.target.value as "" | "UK" | "Global")}
          aria-label="Filter by geographic scope"
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">UK &amp; Global</option>
          <option value="UK">UK</option>
          <option value="Global">Global</option>
        </select>
        {typeOptions.length > 0 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by plant type"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All types</option>
            {typeOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        )}
        {positionOptions.length > 0 && (
          <select
            value={positionFilter}
            onChange={(e) => setPositionFilter(e.target.value)}
            aria-label="Filter by position"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All positions</option>
            {positionOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plants match your search/filters.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {groups.map(([letter, letterPlants]) => (
            <LetterSection
              key={letter}
              letter={letter}
              plants={letterPlants}
              // why isSearching also expands every group: a collapsed "B"
              // section would otherwise hide a search match for something
              // like "Buddleja" even though the user just typed it.
              expanded={isSearching || expandedLetters.has(letter)}
              onToggle={() => toggleLetter(letter)}
              showThumbnails={showThumbnails}
              favouriteIds={favouriteIds}
              expandedPlantIds={expandedPlantIds}
              onTogglePlant={togglePlant}
              onFavouriteChange={handleFavouriteChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
