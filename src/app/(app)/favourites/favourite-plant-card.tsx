"use client";

import Image from "next/image";
import { Card } from "@/components/ui/card";
import { FavouriteButton } from "@/components/quiz/favourite-button";
import { PlantDetails } from "@/components/quiz/plant-details";
import type { QuizPlant } from "@/lib/quiz/types";

export function FavouritePlantCard({
  plant,
  showThumbnail,
  expanded,
  onToggleExpand,
  onUnfavourite,
}: {
  plant: QuizPlant;
  showThumbnail: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onUnfavourite: () => void;
}) {
  function handleFavouriteToggle(next: boolean) {
    if (!next) onUnfavourite();
  }

  // why role="button" divs, not nested <button>s: each card wraps a
  // FavouriteButton (itself a <button>) inside its own expand/collapse
  // toggle — a <button> inside a <button> is invalid HTML that the browser
  // silently un-nests, causing a real React hydration mismatch, not just a
  // lint nit.
  function handleToggleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggleExpand();
    }
  }

  if (!showThumbnail) {
    return (
      <div className="border-b last:border-b-0">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleExpand}
          onKeyDown={handleToggleKeyDown}
          aria-expanded={expanded}
          className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
        >
          <span>
            <span className="text-sm font-medium italic underline-offset-2 hover:underline">
              {plant.scientificName}
            </span>
            {plant.commonName && <span className="text-sm text-muted-foreground"> — {plant.commonName}</span>}
          </span>
          <FavouriteButton plantId={plant.id} initialIsFavourite onToggle={handleFavouriteToggle} />
        </div>
        {expanded && (
          <div className="flex flex-col gap-3 pb-4">
            <PlantDetails plant={plant} />
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="h-full gap-0 overflow-hidden py-0">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={handleToggleKeyDown}
        aria-expanded={expanded}
        className="block w-full text-left"
      >
        <div className="relative aspect-4/3 w-full bg-muted">
          {plant.imageUrl ? (
            <Image src={plant.imageUrl} alt="" fill unoptimized className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No image</div>
          )}
          <FavouriteButton
            plantId={plant.id}
            initialIsFavourite
            onToggle={handleFavouriteToggle}
            className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm hover:bg-background"
          />
        </div>
        <div className="flex flex-col gap-0.5 px-4 py-3">
          <p className="text-sm font-medium italic">{plant.scientificName}</p>
          {plant.commonName && <p className="text-xs text-muted-foreground">{plant.commonName}</p>}
        </div>
      </div>
      {expanded && (
        <div className="flex flex-col gap-3 px-4 pb-4">
          <PlantDetails plant={plant} />
        </div>
      )}
    </Card>
  );
}
