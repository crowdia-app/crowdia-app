import { supabase } from "./supabase";
import type { AgentRun, AgentLog, AgentRunWithLogs } from "../types/database";

export interface DashboardStats {
  totalUsers: number;
  totalEvents: number;
  publishedEvents: number;
  unpublishedEvents: number;
  totalOrganizers: number;
  verifiedOrganizers: number;
  totalLocations: number;
  recentAgentRuns: AgentRun[];
}

export interface AgentStats {
  extractionRuns: number;
  discoveryRuns: number;
  totalEvents: number;
  lastRunTime?: string;
}

/**
 * Fetch dashboard statistics for admin panel
 */
export async function fetchDashboardStats(): Promise<DashboardStats | null> {
  try {
    // Fetch counts in parallel
    const [
      usersResult,
      eventsResult,
      publishedEventsResult,
      organizersResult,
      verifiedOrganizersResult,
      locationsResult,
      recentRunsResult,
    ] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("events").select("id", { count: "exact", head: true }),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("is_published", true),
      supabase.from("organizers").select("id", { count: "exact", head: true }),
      supabase.from("organizers").select("id", { count: "exact", head: true }).eq("is_verified", true),
      supabase.from("locations").select("id", { count: "exact", head: true }),
      supabase
        .from("agent_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(5),
    ]);

    return {
      totalUsers: usersResult.count || 0,
      totalEvents: eventsResult.count || 0,
      publishedEvents: publishedEventsResult.count || 0,
      unpublishedEvents: (eventsResult.count || 0) - (publishedEventsResult.count || 0),
      totalOrganizers: organizersResult.count || 0,
      verifiedOrganizers: verifiedOrganizersResult.count || 0,
      totalLocations: locationsResult.count || 0,
      recentAgentRuns: recentRunsResult.data || [],
    };
  } catch (error) {
    console.error("Failed to fetch dashboard stats:", error);
    return null;
  }
}

/**
 * Fetch agent summary statistics
 */
export async function fetchAgentStats(): Promise<AgentStats | null> {
  try {
    const [extractionRunsResult, discoveryRunsResult, eventsResult, lastRunResult] = await Promise.all([
      supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("agent_type", "extraction"),
      supabase
        .from("agent_runs")
        .select("id", { count: "exact", head: true })
        .eq("agent_type", "discovery"),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("source", "web_search"),
      supabase.from("agent_runs").select("started_at").order("started_at", { ascending: false }).limit(1).single(),
    ]);

    return {
      extractionRuns: extractionRunsResult.count || 0,
      discoveryRuns: discoveryRunsResult.count || 0,
      totalEvents: eventsResult.count || 0,
      lastRunTime: lastRunResult.data?.started_at,
    };
  } catch (error) {
    console.error("Failed to fetch agent stats:", error);
    return null;
  }
}

/**
 * Fetch all agent runs with optional filtering
 */
export async function fetchAgentRuns(
  agentType?: "extraction" | "discovery",
  limit: number = 50
): Promise<AgentRun[]> {
  try {
    let query = supabase.from("agent_runs").select("*").order("started_at", { ascending: false }).limit(limit);

    if (agentType) {
      query = query.eq("agent_type", agentType);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch agent runs:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch agent runs:", error);
    return [];
  }
}

/**
 * Fetch a single agent run with all its logs
 */
export async function fetchAgentRunWithLogs(runId: string): Promise<AgentRunWithLogs | null> {
  try {
    const [runResult, logsResult] = await Promise.all([
      supabase.from("agent_runs").select("*").eq("id", runId).single(),
      supabase.from("agent_logs").select("*").eq("agent_run_id", runId).order("timestamp", { ascending: true }),
    ]);

    if (runResult.error) {
      console.error("Failed to fetch agent run:", runResult.error);
      return null;
    }

    return {
      ...runResult.data,
      logs: logsResult.data || [],
    };
  } catch (error) {
    console.error("Failed to fetch agent run with logs:", error);
    return null;
  }
}

/**
 * Fetch logs for a specific agent run with pagination
 */
export async function fetchAgentLogs(
  runId: string,
  offset: number = 0,
  limit: number = 100,
  level?: AgentLog["level"]
): Promise<AgentLog[]> {
  try {
    let query = supabase
      .from("agent_logs")
      .select("*")
      .eq("agent_run_id", runId)
      .order("timestamp", { ascending: true })
      .range(offset, offset + limit - 1);

    if (level) {
      query = query.eq("level", level);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Failed to fetch agent logs:", error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error("Failed to fetch agent logs:", error);
    return [];
  }
}
