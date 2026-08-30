// why proxy.ts, not middleware.ts: Next.js 16 renamed the file (same
// behaviour, exported function renamed middleware -> proxy) — see BC2's
// Learnings, which hit this the hard way.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// why /api/cron here too: it has its own bearer-token check (CRON_SECRET)
// against the request Vercel Cron itself sends, which carries no user
// session — gating it behind a signed-in user would make it uncallable.
const PUBLIC_PATHS = ["/sign-in", "/auth", "/api/cron"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // why getUser() not getSession(): getSession() trusts the cookie as-is;
  // getUser() revalidates the token against Supabase Auth on every request,
  // which is the only way to reliably detect a session that's been revoked.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) => request.nextUrl.pathname.startsWith(path));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  if (user && !isPublicPath) {
    // why checked here, on every request, not only at sign-in: an admin
    // removing someone from the allow-list must take effect immediately for
    // an already-signed-in session, not just block a future login attempt.
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_allowed")
      .eq("id", user.id)
      .single();

    if (!profile?.is_allowed) {
      const url = request.nextUrl.clone();
      url.pathname = "/sign-in";
      url.searchParams.set("notAllowed", "1");
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
