import { getSupabase } from "./client";

/**
 * Clean up stuck agent runs that have been running for too long
 * This handles cases where the process crashed or timed out without completing
 */
export async function cleanupStuckRuns(maxAgeMinutes: number = 30): Promise<number> {
  const supabase = getSupabase();

  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("agent_runs")
    .update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: `Run timed out after ${maxAgeMinutes} minutes - automatically marked as failed`,
    })
    .eq("status", "running")
    .lt("started_at", cutoffTime)
    .select("id");

  if (error) {
    console.error("Failed to cleanup stuck runs:", error);
    return 0;
  }

  return data?.length || 0;
}
