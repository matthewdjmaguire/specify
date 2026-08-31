"use client";

import { useMemo, useState } from "react";
import { PlantCard } from "@/components/quiz/plant-card";
import type { QuizPlant } from "@/lib/quiz/types";

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function FavouritesView({ plants: initialPlants }: { plants: QuizPlant[] }) {
  const [plants, setPlants] = useState(initialPlants);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  // why "" (All), not defaulting to the profile's quiz geo_scope: browsing
  // favourites is a different job from generating a quiz — someone should
  // see everything they've favourited by default, then narrow down if they
  // want to check what's UK-hardy specifically.
  const [geoFilter, setGeoFilter] = useState<"" | "UK" | "Global">("");
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const typeOptions = useMemo(() => uniqueSorted(plants.flatMap((p) => p.plantTypes)), [plants]);
  const positionOptions = useMemo(() => uniqueSorted(plants.flatMap((p) => p.position)), [plants]);

  const filteredPlants = useMemo(() => {
    const term = query.trim().toLowerCase();
    return plants
      .filter((p) => {
        if (term) {
          const haystack = `${p.scientificName} ${p.commonName ?? ""}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        if (typeFilter && !p.plantTypes.includes(typeFilter)) return false;
        if (positionFilter && !p.position.includes(positionFilter)) return false;
        if (geoFilter && !p.geoTags.includes(geoFilter)) return false;
        return true;
      })
      .sort((a, b) => a.scientificName.localeCompare(b.scientificName));
  }, [plants, query, typeFilter, positionFilter, geoFilter]);

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function expandAll() {
    setExpandedIds(new Set(filteredPlants.map((p) => p.id)));
  }

  function collapseAll() {
    setExpandedIds(new Set());
  }

  function handleFavouriteChange(id: string, next: boolean) {
    if (next) return;
    setPlants((prev) => prev.filter((p) => p.id !== id));
    setExpandedIds((prev) => {
      if (!prev.has(id)) return prev;
      const copy = new Set(prev);
      copy.delete(id);
      return copy;
    });
  }

  if (initialPlants.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No favourites yet — tap the heart on any plant during a quiz to save it here.
      </p>
    );
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
          placeholder="Search favourites…"
          aria-label="Search favourites"
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

      {filteredPlants.length === 0 ? (
        <p className="text-sm text-muted-foreground">No favourites match your search/filters.</p>
      ) : showThumbnails ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredPlants.map((plant) => (
            <PlantCard
              key={plant.id}
              plant={plant}
              isFavourite
              showThumbnail
              expanded={expandedIds.has(plant.id)}
              onToggleExpand={() => toggleExpand(plant.id)}
              onFavouriteChange={(next) => handleFavouriteChange(plant.id, next)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border">
          {filteredPlants.map((plant) => (
            <div key={plant.id} className="px-3">
              <PlantCard
                plant={plant}
                isFavourite
                showThumbnail={false}
                expanded={expandedIds.has(plant.id)}
                onToggleExpand={() => toggleExpand(plant.id)}
                onFavouriteChange={(next) => handleFavouriteChange(plant.id, next)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
