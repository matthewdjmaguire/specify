// why a hash of the date, not Math.random(): the homepage needs the *same*
// plant for every visit within a day (across users, across page loads), and
// a different one tomorrow — Math.random() would pick a new plant on every
// render. Hashing "today's date string" into an index is deterministic per
// day and needs no stored state.
export function dailyIndex(date: Date, count: number): number {
  if (count <= 0) return 0;
  const dateKey = date.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  let hash = 0;
  for (let i = 0; i < dateKey.length; i++) {
    hash = (hash * 31 + dateKey.charCodeAt(i)) >>> 0;
  }
  return hash % count;
}
