"use client";

import { useMemo, useState } from "react";
import { FavouritePlantCard } from "./favourite-plant-card";
import type { QuizPlant } from "@/lib/quiz/types";

function uniqueSorted(values: Array<string | null>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b));
}

export function FavouritesView({ plants: initialPlants }: { plants: QuizPlant[] }) {
  const [plants, setPlants] = useState(initialPlants);
  const [query, setQuery] = useState("");
  const [habitFilter, setHabitFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [showThumbnails, setShowThumbnails] = useState(true);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const habitOptions = useMemo(() => uniqueSorted(plants.map((p) => p.habit)), [plants]);
  const positionOptions = useMemo(() => uniqueSorted(plants.flatMap((p) => p.position)), [plants]);

  const filteredPlants = useMemo(() => {
    const term = query.trim().toLowerCase();
    return plants
      .filter((p) => {
        if (term) {
          const haystack = `${p.scientificName} ${p.commonName ?? ""}`.toLowerCase();
          if (!haystack.includes(term)) return false;
        }
        if (habitFilter && p.habit !== habitFilter) return false;
        if (positionFilter && !p.position.includes(positionFilter)) return false;
        return true;
      })
      .sort((a, b) => a.scientificName.localeCompare(b.scientificName));
  }, [plants, query, habitFilter, positionFilter]);

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

  function handleUnfavourite(id: string) {
    setPlants((prev) => prev.filter((p) => p.id !== id));
    setExpandedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
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
        {habitOptions.length > 0 && (
          <select
            value={habitFilter}
            onChange={(e) => setHabitFilter(e.target.value)}
            aria-label="Filter by plant type"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All types</option>
            {habitOptions.map((h) => (
              <option key={h} value={h}>
                {h}
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
            <FavouritePlantCard
              key={plant.id}
              plant={plant}
              showThumbnail
              expanded={expandedIds.has(plant.id)}
              onToggleExpand={() => toggleExpand(plant.id)}
              onUnfavourite={() => handleUnfavourite(plant.id)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border">
          {filteredPlants.map((plant) => (
            <div key={plant.id} className="px-3">
              <FavouritePlantCard
                plant={plant}
                showThumbnail={false}
                expanded={expandedIds.has(plant.id)}
                onToggleExpand={() => toggleExpand(plant.id)}
                onUnfavourite={() => handleUnfavourite(plant.id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
