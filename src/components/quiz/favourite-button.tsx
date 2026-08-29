"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleFavourite } from "@/app/actions/favourites";

export function FavouriteButton({
  plantId,
  initialIsFavourite,
  className = "",
  onToggle,
}: {
  plantId: string;
  initialIsFavourite: boolean;
  className?: string;
  // why a callback, not just letting the button own all its state: the
  // favourites page removes a plant from its own list as soon as it's
  // unfavourited from there — the button doesn't know about that list.
  onToggle?: (next: boolean) => void;
}) {
  const [isFavourite, setIsFavourite] = useState(initialIsFavourite);
  const [isPending, startTransition] = useTransition();

  function handleClick(e: React.MouseEvent) {
    // why stopPropagation: this button is used inside clickable
    // expand/collapse cards (the favourites page, quiz thumbnails) —
    // without it, toggling a favourite would also fire the card's own
    // click handler.
    e.stopPropagation();
    e.preventDefault();
    const next = !isFavourite;
    setIsFavourite(next);
    onToggle?.(next);
    startTransition(async () => {
      try {
        await toggleFavourite(plantId, next);
      } catch {
        setIsFavourite(!next);
        onToggle?.(!next);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={isFavourite}
      aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
      className={`rounded-full p-1.5 transition-colors hover:bg-muted disabled:opacity-50 ${className}`}
    >
      <Heart className={`size-5 ${isFavourite ? "fill-destructive text-destructive" : "text-muted-foreground"}`} />
    </button>
  );
}
