"use client";

import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function SignInForm() {
  const searchParams = useSearchParams();
  const notAllowed = searchParams.get("notAllowed");

  async function handleSignIn() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <Image src="/logo.svg" alt="" width={56} height={56} priority />
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to Specify</h1>
      <p className="max-w-sm text-center text-sm text-muted-foreground">
        Learn plant names and characteristics, one quiz at a time.
      </p>
      {notAllowed && (
        <p className="max-w-sm text-center text-sm text-destructive">
          That Google account hasn&apos;t been invited yet. Ask an admin to add you.
        </p>
      )}
      <Button onClick={handleSignIn} size="lg">
        Continue with Google
      </Button>
    </div>
  );
}
