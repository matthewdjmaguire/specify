"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { updateProfileSettings, type ProfileSettingsInput } from "@/app/actions/profile";

const GEO_OPTIONS: Array<{ value: ProfileSettingsInput["geoScope"]; label: string }> = [
  { value: "UK", label: "UK" },
  { value: "Global", label: "Global" },
];

const QUIZ_LENGTH_OPTIONS: ProfileSettingsInput["quizLength"][] = [20, 50, 100];

function SelectableGroup<T extends string | number>({
  value,
  options,
  labels,
  onChange,
}: {
  value: T;
  options: T[];
  labels?: Record<string, string>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
            option === value ? "border-primary bg-secondary" : "border-border hover:bg-muted"
          }`}
        >
          {labels?.[String(option)] ?? option}
        </button>
      ))}
    </div>
  );
}

export function SettingsForm({ initial }: { initial: ProfileSettingsInput }) {
  const [geoScope, setGeoScope] = useState(initial.geoScope);
  const [quizLength, setQuizLength] = useState(initial.quizLength);
  const [followupCount, setFollowupCount] = useState(initial.followupCount);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(false);
    startTransition(async () => {
      await updateProfileSettings({ geoScope, quizLength, followupCount });
      setSaved(true);
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Geographic scope</label>
        <p className="text-xs text-muted-foreground">Filters which plants come up in quizzes.</p>
        <SelectableGroup value={geoScope} options={GEO_OPTIONS.map((o) => o.value)} onChange={setGeoScope} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Quiz length</label>
        <p className="text-xs text-muted-foreground">Number of plants per quiz.</p>
        <SelectableGroup value={quizLength} options={QUIZ_LENGTH_OPTIONS} onChange={setQuizLength} />
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Follow-up questions per plant</label>
        <p className="text-xs text-muted-foreground">1–5 characteristic questions after each identification.</p>
        <SelectableGroup
          value={followupCount}
          options={[1, 2, 3, 4, 5]}
          onChange={setFollowupCount}
        />
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save settings"}
        </Button>
        {saved && !isPending && <span className="text-sm text-success">Saved.</span>}
      </div>
    </div>
  );
}
