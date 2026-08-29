"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { setUserAdmin, deleteUser, type AdminDirectoryEntry } from "@/app/actions/admin";

export function UserRow({ entry, currentUserId }: { entry: AdminDirectoryEntry; currentUserId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSelf = entry.id === currentUserId;
  const label = entry.displayName || entry.email;

  function handleToggleAdmin() {
    setError(null);
    startTransition(async () => {
      try {
        await setUserAdmin(entry.id, !entry.isAdmin);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't update admin status.");
      }
    });
  }

  function handleDelete() {
    setError(null);
    startTransition(async () => {
      try {
        await deleteUser(entry.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't delete user.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">
            {label} {entry.isPrimaryAdmin && <Badge className="ml-1">Primary admin</Badge>}
          </p>
          <p className="text-sm text-muted-foreground">{entry.email}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleAdmin}
            disabled={isPending || entry.isPrimaryAdmin || (isSelf && entry.isAdmin)}
          >
            {entry.isAdmin ? "Demote" : "Promote"}
          </Button>
          {confirming ? (
            <>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={isPending}>
                {isPending ? "Deleting…" : `Delete ${label}`}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)} disabled={isPending}>
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirming(true)}
              disabled={isPending || entry.isPrimaryAdmin}
            >
              Delete
            </Button>
          )}
        </div>
      </div>
      {confirming && (
        <p className="text-xs text-muted-foreground">
          This permanently deletes {label}&apos;s account and all their quiz data. This cannot be undone.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
