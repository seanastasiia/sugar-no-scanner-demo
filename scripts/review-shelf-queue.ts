// Read-only by default. Run with the existing Railway/Supabase server environment.
import { getSupabaseAdmin } from "../src/server/supabase";

const db = getSupabaseAdmin();
if (!db) throw new Error("Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY; do not paste credentials into output.");
const retry = process.argv.indexOf("--retry");
if (retry >= 0) {
  const id = process.argv[retry + 1] || "";
  if (!/^[a-f0-9]{64}$/.test(id)) throw new Error("Supply the exact queue job ID after --retry.");
  const { data, error } = await db.from("shelf_research_jobs").update({ status: "queued", attempts: 0, reason: "", available_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id).in("status", ["review", "needs_info", "failed"]).select("id,status");
  if (error) throw new Error("Queue retry failed.");
  console.log(JSON.stringify({ retried: data }));
} else {
  const { data, error } = await db.from("shelf_research_jobs").select("id,lookup,status,reason,missing,attempts,updated_at")
    .in("status", ["review", "needs_info", "failed", "retry"]).order("updated_at").limit(100);
  if (error) throw new Error("Queue read failed; apply its Supabase migration first.");
  console.log(JSON.stringify({ jobs: data }, null, 2));
}
