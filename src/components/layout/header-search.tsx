"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { searchAll, type SearchResults } from "@/app/actions/search";

const EMPTY: SearchResults = { themes: [], plants: [] };

export function HeaderSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [dismissed, setDismissed] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  const term = query.trim();

  useEffect(() => {
    if (term.length < 2) return;
    // why a 200ms debounce: without it, every keystroke fires a server
    // action round-trip — fine at this data scale, but a search box that
    // visibly re-fetches on every character reads as janky.
    const timeout = setTimeout(() => {
      startTransition(async () => {
        setResults(await searchAll(term));
      });
    }, 200);
    return () => clearTimeout(timeout);
  }, [term]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasResults = results.themes.length > 0 || results.plants.length > 0;
  const open = term.length >= 2 && !dismissed && (hasResults || isPending);

  function handleSelect() {
    setDismissed(true);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setDismissed(false);
        }}
        onFocus={() => setDismissed(false)}
        placeholder="Search plants and quizzes…"
        aria-label="Search plants and quizzes"
        className="w-full rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg border bg-popover p-2 shadow-md">
          {!hasResults && !isPending && <p className="px-2 py-1 text-sm text-muted-foreground">No results.</p>}
          {results.themes.length > 0 && (
            <div className="mb-2">
              <p className="px-2 text-xs font-medium text-muted-foreground">Quizzes</p>
              {results.themes.map((t) => (
                <Link
                  key={t.id}
                  href={`/quiz/${t.id}`}
                  onClick={handleSelect}
                  className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  {t.displayName}
                </Link>
              ))}
            </div>
          )}
          {results.plants.length > 0 && (
            <div>
              <p className="px-2 text-xs font-medium text-muted-foreground">Plants</p>
              {results.plants.map((p) => (
                <a
                  key={p.id}
                  href={p.sourceUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleSelect}
                  className="block rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="italic">{p.scientificName}</span>
                  {p.commonName && <span className="text-muted-foreground"> — {p.commonName}</span>}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
