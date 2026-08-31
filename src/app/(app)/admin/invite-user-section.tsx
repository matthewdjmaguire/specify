"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { inviteUser } from "@/app/actions/admin";

export function InviteUserSection() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    startTransition(async () => {
      try {
        const result = await inviteUser(email);
        if (result.unlockedExistingAccount) {
          setMessage({ text: `${email} already had an account — unlocked their sign-in.`, isError: false });
        } else if (result.alreadyInvited) {
          setMessage({ text: `${email} was already invited.`, isError: false });
        } else {
          setMessage({ text: `${email} can now sign in with Google.`, isError: false });
        }
        setEmail("");
        router.refresh();
      } catch (err) {
        setMessage({ text: err instanceof Error ? err.message : "Couldn't send the invite.", isError: true });
      }
    });
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-3">
      <h2 className="text-lg font-medium">Invite a user</h2>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-1 basis-64 flex-col gap-1">
          <label htmlFor="invite-email" className="text-xs font-medium">
            Email address
          </label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <Button type="submit" disabled={isPending || !email.trim()}>
          {isPending ? "Inviting…" : "Invite"}
        </Button>
      </form>
      {message && (
        <p className={`text-sm ${message.isError ? "text-destructive" : "text-success"}`}>{message.text}</p>
      )}
      <p className="text-xs text-muted-foreground">
        They&apos;ll be able to sign in with Google using this email — no invite email is sent, just tell them
        directly.
      </p>
    </section>
  );
}
