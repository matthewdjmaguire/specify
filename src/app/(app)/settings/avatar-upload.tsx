"use client";

import { useRef, useState, useTransition } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { updateAvatarUrl } from "@/app/actions/profile";

const MAX_SIZE_BYTES = 2 * 1024 * 1024;

function initialsFor(displayName: string): string {
  const initials = displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return initials || "?";
}

export function AvatarUpload({
  userId,
  displayName,
  avatarUrl,
}: {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("Image must be under 2MB.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const ext = file.name.split(".").pop() || "jpg";
      // why a timestamp in the path, not a fixed "avatar.ext": the bucket is
      // public and served via a CDN-cacheable URL — overwriting the same
      // path would mean a browser (or the profile dropdown elsewhere on the
      // page) keeps showing the old cached image after a change.
      const path = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setPreview(data.publicUrl);
      try {
        await updateAvatarUrl(data.publicUrl);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save avatar.");
      }
    });
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16">
        <AvatarImage src={preview ?? undefined} alt="" />
        <AvatarFallback className="text-lg">{initialsFor(displayName)}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-1">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={isPending}>
          {isPending ? "Uploading…" : "Change avatar"}
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
