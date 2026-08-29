import { createClient } from "@supabase/supabase-js";

// why service-role, not the cookie-based server client: admin actions must
// change another user's profiles row and delete their auth.users row, which
// normal RLS (self-only) never allows. The profiles_guard trigger's
// primary-admin invariants apply unconditionally, even to service-role, so
// this doesn't bypass those — only the "own row only" restriction.
export function createServiceRoleClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
