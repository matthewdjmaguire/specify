# Specify 🌱

A flashcard/quiz app that helps garden designers learn plant scientific names and
characteristics — built for Jamie, a newly qualified Garden Designer.

Not yet built. See [`CLAUDE.md`](./CLAUDE.md) for the project charter, and the
[Notion app page](https://app.notion.com/p/3cbc7c13fcb881a1a8ebe95dbf60ab4e) for the full
architecture, data model, and backlog.

## Stack

- Next.js (App Router, TypeScript) on Vercel
- Supabase (Postgres + Auth + Storage)
- Tailwind + shadcn/ui
- Vitest (unit) + Playwright (e2e)

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

Pulled automatically from the linked Vercel project (Supabase provisioned via the Vercel
Marketplace integration):

```bash
vercel env pull .env.local
```

Key variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-safe),
`SUPABASE_SERVICE_ROLE_KEY` (server-side only, never exposed to the browser),
`POSTGRES_URL_NON_POOLING` (direct connection, used for applying migrations).

## Database migrations

Version-controlled under `supabase/migrations/`. Applied directly via `psql` against
`POSTGRES_URL_NON_POOLING` (no Supabase CLI login required):

```bash
psql "$POSTGRES_URL_NON_POOLING" -f supabase/migrations/<file>.sql
```
