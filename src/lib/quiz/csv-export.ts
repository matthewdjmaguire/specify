export type AttemptExportRow = {
  themeName: string;
  mode: string;
  startedAt: string;
  completedAt: string | null;
  correctCount: number;
  totalQuestions: number;
};

// why quote-and-escape rather than trust the input: theme display names are
// free text the user typed themselves — a comma or line break in a name
// would otherwise silently corrupt the CSV's column structure.
//
// why also neutralize a leading =/+/-/@: those trigger formula evaluation in
// Excel/Sheets even inside a quoted field (CWE-1236) — a theme named e.g.
// `=HYPERLINK("http://evil.example",...)` would execute as a live formula
// when the exported CSV is opened, not just display as text.
function csvField(value: string): string {
  const escaped = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\r\n]/.test(escaped)) {
    return `"${escaped.replace(/"/g, '""')}"`;
  }
  return escaped;
}

export function generateQuizHistoryCsv(rows: AttemptExportRow[]): string {
  const header = ["Theme", "Mode", "Date", "Score"];
  const lines = [header.join(",")];
  for (const row of rows) {
    const date = row.completedAt ?? row.startedAt;
    const score = `${row.correctCount}/${row.totalQuestions}`;
    lines.push([row.themeName, row.mode, date, score].map(csvField).join(","));
  }
  return lines.join("\r\n");
}
