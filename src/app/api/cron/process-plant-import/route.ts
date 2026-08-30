import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { processImportJobTick } from "@/lib/import/process-import-job";

export const maxDuration = 60;

// why a bearer-token check, not just relying on the route being obscure:
// this endpoint runs with service-role privileges (writes to `plants`
// unauthenticated) — Vercel's own recommended pattern for securing a Cron
// Job's HTTP endpoint from being triggered by anyone who finds the URL.
function isAuthorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data: job, error } = await supabase
    .from("plant_import_jobs")
    .select("*")
    .in("status", ["pending", "running"])
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!job) return NextResponse.json({ message: "No pending import jobs." });

  if (job.status === "pending") {
    await supabase.from("plant_import_jobs").update({ status: "running" }).eq("id", job.id);
  }

  try {
    await processImportJobTick(supabase, job);
  } catch (err) {
    await supabase
      .from("plant_import_jobs")
      .update({ status: "failed", error_message: err instanceof Error ? err.message : "Unknown error" })
      .eq("id", job.id);
    return NextResponse.json({ error: "Tick failed", jobId: job.id }, { status: 500 });
  }

  return NextResponse.json({ processed: job.id });
}
