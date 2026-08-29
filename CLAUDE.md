@AGENTS.md

# Specify

> **Preset:** Quick-MVP. A flashcard/quiz app that helps garden designers learn plant
> scientific names and characteristics.

## PROJECT CHARTER
- **App:** Specify — a flashcard/quiz app that helps garden designers learn plant scientific
  names and characteristics, starting with Matt's wife Jamie (newly qualified Garden Designer)
- **Profile:** Quick-MVP (justification: no financial/health data, invite-only rollout even
  though the data model is multi-tenant from day one — blast radius stays low while the user
  base is small and known)
- **Users & core jobs:** Garden designers (led by Jamie) — learn to recognise plants by
  scientific name from a photo; graduate through Learning → Intermediate → Hard difficulty;
  build/run themed quizzes (e.g. "Trees", "UK Hanging Baskets"); track progress and identify
  weak areas
- **In scope (v1):** Google OAuth (invite-only allow-list), 3 quiz modes (Learning/flashcard,
  Intermediate/4-option multiple choice, Hard/free-text with fuzzy matching), plant-name
  question + configurable follow-up characteristic questions (soil/hardiness/position/
  height/spread etc.), Lucky Dip + curated global quiz themes + personal user-created themes,
  UK/Global geo-scope toggle, quiz-length setting (20/50/100), per-plant spaced-repetition-
  style prioritisation, tube-map style quiz progress UI, end-of-quiz summary with a
  "Create Quiz" deep link from a weak area, homepage stats, settings page, and an admin
  interface (user directory — identity fields only, never quiz data — promote/demote admins,
  delete users, edit the curated global quiz theme set)
- **Out of scope (v1):** Beth Chatto as a primary data source (secondary/supplementary only),
  open self-serve sign-up (invite-only for now), native mobile app (PWA), LLM-based question
  generation, payments/commerce
- **Data sensitivity:** personal data only (name, email, avatar, quiz history) — no financial
  or health data. **Blast radius:** low — a leak exposes quiz scores and an email address
- **Stack:** Next.js (App Router, TypeScript) full-stack on Vercel · Supabase (Postgres +
  Auth + Storage) · Tailwind + shadcn/ui, mobile-first · TanStack Query · Vitest + Playwright
- **Environments:** single Supabase project + Vercel prod/preview deployments per branch
- **Auth & secrets:** Supabase Auth, Google OAuth only, invite-only allow-list enforced in
  the database; secrets in Vercel/Supabase env vars only, never in the repo
- **Autonomy level:** Fully autonomous — commit straight to `main`, Vercel auto-deploys prod
  on every merge, single end-of-build review pass with Matt (Playwright-assisted)
- **UI direction:** olive green, pastel palette; simple plant-mark logo; left sidebar nav
  (desktop) + bottom nav (mobile); WCAG AA baseline
- **Docs home:** [Specify - App Reference](https://app.notion.com/p/3cbc7c13fcb881a1a8ebe95dbf60ab4e) —
  backlog embedded there / standalone: [Feature Backlog](https://app.notion.com/p/187854ec17cd46bb8c3a9d3f724ee58d)
- **Charter agreed:** 2026-08-29 by Matt

---

## Data sourcing (read this before touching anything plant-related)
Plant data is scraped from **RHS (primary)** and Beth Chatto (secondary). **Images are
hotlinked directly to the source domain's own URL, never downloaded or copied into our
Storage** — lowest copyright exposure, and matches the rule that images may only ever come
from these two sites. RHS publishes no public API and no clear general-reuse licence for
their data/photography — this is a standing legal risk to revisit if the app ever grows
beyond a small invite-only user base. See the Notion app page's Decision Log and Learnings
for the full reasoning (confirmed via a live POC of RHS's page structure — `schema.org`
`Taxon` JSON-LD + structured characteristic fields, no headless browser needed).

## Stack
- Full-stack single deployable: **Next.js** (App Router, TypeScript) on **Vercel**, data +
  auth from **Supabase** (Postgres + Auth + Storage). One repo, one deploy.
- **Tailwind + shadcn/ui**, mobile-first. **TanStack Query** for server state.
- **Vitest** (unit) + **Playwright** (e2e).
- Migrations under version control: `supabase/migrations/` — never click tables together in
  the Supabase dashboard.
- Preview deploys: every branch/PR gets an automatic Vercel preview URL.

## Conventions
- **No secrets in the repo.** Platform env vars only (Vercel/Supabase project settings).
- **Row-Level Security (RLS) from the start** on every table scoped to a user. The admin
  interface is identity-management only — RLS on quiz tables has **no admin bypass**; see
  SPEC-021/SPEC-007's ADR in the Notion page before changing anything there.
- Keep `README.md` current: how to run it locally and what the env vars are.

## Explain as you go
Add a one-line **why** comment on any non-obvious bit, and break out uncommon abbreviations.

## Feature workflow *(lean)*
1. **Pick the next ticket** from the Notion backlog, respecting `Sequence` and
   `Dependencies` (dependencies are also noted in each ticket's Context section).
2. **Branch** — `feat/<ticket-id>-<slug>` off `main` (e.g. `feat/spec-010-quiz-engine`).
3. **Build** — implement it. Tests on anything with real logic (fuzzy matching, prioritisation
   weighting, RLS policies, admin data-minimisation) per the ticket's Test plan.
4. **Review pass** — run `/simplify`. Run `/security-review` if the change touches auth,
   data access, RLS policies, secrets, or the admin surface.
5. **Self-review** — open the preview URL on an actual mobile viewport, check acceptance
   criteria.
6. **Merge** — commit/merge to `main`; Vercel deploys prod automatically.
7. **Document** — update the Notion app page (the section the ticket touched) + move the
   ticket to Done, filling in Decisions & Learnings.

## Git workflow
**Commit straight to `main`** rather than PR-per-ticket — same choice as Bean Counter v2, for
the same reasons (fully autonomous, low blast radius, single end-of-build review planned).

## Review gates *(lightweight, but not zero)*
- `/simplify` on anything non-trivial (self-invoke).
- `/security-review` whenever auth, RLS/data-access, secrets, or the admin surface are
  involved (self-invoke) — the admin interface's data-minimisation promise is the single
  easiest thing to accidentally break here.
- `/code-review` available for a deeper pass; not required at this profile.

## Testing & CI *(light)*
- Tests on the risky logic as each ticket lands: fuzzy-match tolerance (SPEC-013),
  prioritisation weighting (SPEC-010/017), RLS policies (SPEC-004/007), admin
  data-minimisation (SPEC-021).
- A small `on: push` GitHub Actions workflow (build + lint + unit test) — SPEC-025.
- Playwright e2e golden-path suite — SPEC-026.

## Security posture *(the short list that actually matters here)*
- **Auth:** Supabase Auth, Google OAuth only. Invite-only — `profiles.is_allowed` checked
  server-side on every session, not just hidden in the UI.
- **Authorisation:** enforced in the database with **RLS**. `plants` and global quiz themes
  are readable by all authenticated users; everything else is owner-scoped.
- **Admin ≠ superuser:** the admin role can manage user identities (promote/demote/delete)
  and the curated global quiz set, but has **no read access to any user's quiz data** —
  enforced via a dedicated view/RPC exposing only identity fields, not UI discipline.
  `matthewdjmaguire@gmail.com` is seeded as `is_primary_admin`, a flag no UI path can toggle.
- **Secrets:** platform env vars only; anon key on the client, service-role key server-side
  only (used by the scraper/import scripts and admin server actions).
- **Data:** if this ever needs to hold health/financial data or scales to a point where a
  leak would matter beyond "some quiz scores and an email," STOP and move to the Standard
  preset.

## UI standards *(never plain boilerplate — hard rule even for MVPs)*
- **shadcn/ui + Tailwind**, olive green pastel palette, simple plant-mark logo.
- Mobile-first — Jamie will likely use this standing in a garden on her phone.
- Coherent type scale, spacing, colour tokens; real loading/empty/error states.
- WCAG AA basics: semantic elements, labelled inputs, visible focus, reasonable contrast.

## Documentation & Notion
- **Notion access is allow-listed**: Claude may read/write the
  [Specify - App Reference](https://app.notion.com/p/3cbc7c13fcb881a1a8ebe95dbf60ab4e) page
  and its embedded [Feature Backlog](https://app.notion.com/p/187854ec17cd46bb8c3a9d3f724ee58d)
  only — never browse or search the rest of the workspace.
- Ticket bodies carry: Context, Requirements, Build plan, Test plan, Acceptance criteria,
  Decisions & notes, Learnings.
- Update the app page when a ticket merges — a five-minute habit, not a big-bang at the end.

## Autonomy limits
- Fully autonomous is the agreed mode here — but untested auth/RLS/admin code still stops
  for a human look.
- The moment data sensitivity or user count rises beyond a small invite-only group in a way
  that changes the blast radius, switch presets and re-run the relevant interview sections.

## Learnings capture
Hit a surprising bug or platform gotcha? Add a one-line note here so it isn't rediscovered
the hard way. (Mirrored in the Notion app page's Learnings section — keep both in sync.)
- **RHS plant pages are server-rendered with `schema.org` `Taxon` JSON-LD** — a plain `curl`
  with a normal user-agent returns full characteristic data (soil, hardiness, position,
  height/spread, etc.) directly in the HTML. No headless browser needed for the scraper
  (SPEC-001).
- **RHS has no discoverable public API or general "terms of use" page** licensing data/image
  reuse. Treat bulk scraping as a standing, unresolved legal risk — mitigated for v1 by
  hotlinking images (never mirrored) and keeping the seed set small/curated rather than
  crawling their full ~306k-page catalogue.
- **A test that inserts into a shared/global table (not owned by a test user) leaks permanently if cleanup only deletes test users.** SPEC-007's admin-global-theme test created a real global `quiz_themes` row every run; no FK ties it to the deleted test user, so it never got cascaded away. 14 copies had silently accumulated in the live database, surfaced only via a live bug report on the `/quizzes` page. Any test inserting into `plants` or a global (`owner_id = null`) `quiz_themes` row must track and delete what it created in `afterAll` — the per-user cascade safety net doesn't apply.
- **Supabase-js query builders are not real Promises — `.catch()` chained directly after a query throws `TypeError: ... .catch is not a function`.** Hit this twice writing RLS test cleanup (`quizzes.rls.test.ts`, then `plant-stats.rls.test.ts`) before it made it here. Use `try { await query } catch {}` instead of `query.catch(() => {})`.
- **This shadcn install is built on Base UI, not Radix** — `shadcn init` picked `@base-ui/react`
  under the hood. Base UI has no `asChild` prop; its polymorphism API is a `render` prop
  instead (`<DropdownMenuItem render={<Link href="/x">X</Link>} />`, not
  `<DropdownMenuItem asChild><Link>X</Link></DropdownMenuItem>`). Every future ticket that
  composes a shadcn menu/dialog/tooltip trigger with `next/link` or a custom element needs
  this — found via a real TS error building SPEC-008's profile dropdown, not from docs.
- **A Storage bucket needs a SELECT RLS policy even if the client never reads objects back.** Avatar upload (`upload(path, file, { upsert: true })`) failed with "new row violates row-level security policy" despite correct INSERT/UPDATE policies, a verified-valid session/JWT, and a correct path — because `upsert: true` compiles to `INSERT ... ON CONFLICT DO UPDATE`, and Postgres RLS requires SELECT permission to plan the conflict check even when no conflict occurs. Isolated by bisecting raw authenticated `fetch()` calls against the Storage REST API header-by-header (`x-upsert: true` alone reproduced it). Any bucket policy set using client-side `upsert: true` needs all four of SELECT/INSERT/UPDATE/DELETE, not three (SPEC-018).
- **A standalone `tsc --noEmit` fails on a fresh checkout — `.next/types/` doesn't exist yet.** `LayoutProps` and other Next-generated globals only appear after `next dev`/`next build` has run at least once; this passed locally all session purely because a build had already happened, and only failed on the real first CI run against a clean checkout. Fixed the `typecheck` script to `next typegen && tsc --noEmit` — `next typegen` generates route types without a full build (SPEC-025).
- **A bounded-trial statistical test's "this won't flake" comment is worth actually computing the odds for.** SPEC-010's weighted-sampling test picked 2000 trials to assert a 1000:1-weight low-probability item gets chosen at least once — but at that ratio it wins any single draw roughly 1 in 1000 times, giving a real ~13% chance of zero hits across 2000 tries by pure chance. Passed every local run this session by luck (`Math.random()` varies run to run); the first real CI run hit the ~13% case. Fixed by raising to 20000 trials (false-failure rate ~1e-9) (SPEC-025).
