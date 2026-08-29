import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// why: writing cookies from a Server Component (not a Server Action/Route
// Handler) throws — that's expected and harmless here because the proxy
// (src/proxy.ts) already refreshes the session on every request, so a
// Server Component only ever needs to *read* the session, never write it.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // called from a Server Component — safe to ignore, see above.
          }
        },
      },
    },
  );
}
