// why: Next.js loads .env.local automatically for the app itself, but Vitest
// doesn't — RLS integration tests need real Supabase env vars in process.env.
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local may not exist in CI; tests that need it will fail loudly with
  // a clear "missing env var" error instead.
}
