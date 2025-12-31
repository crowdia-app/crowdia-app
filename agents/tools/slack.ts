import { config } from "../config";

export async function sendSlackMessage(text: string): Promise<void> {
  if (!config.slackWebhook) {
    console.log("[Slack disabled]", text);
    return;
  }

  try {
    const response = await fetch(config.slackWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      console.error("Slack notification failed:", await response.text());
    }
  } catch (error) {
    console.error("Slack notification error:", error);
  }
}

export interface AgentReport {
  agentName: string;
  status: "success" | "partial" | "failed";
  duration: number;
  stats: Record<string, number>;
  errors: string[];
}

export async function sendAgentReport(report: AgentReport): Promise<void> {
  const { agentName, status, duration, stats, errors } = report;

  const statusEmoji = { success: "✅", partial: "⚠️", failed: "❌" }[status];

  const durationStr =
    duration > 60000
      ? `${Math.round(duration / 60000)}m ${Math.round((duration % 60000) / 1000)}s`
      : `${Math.round(duration / 1000)}s`;

  // Check if we have rate limit errors
  const rateLimitErrors = errors.filter(e => e.toLowerCase().includes('rate limit'));
  const hasRateLimitIssue = rateLimitErrors.length > 0;

  // Build a more informative message
  let message = `${statusEmoji} *${agentName} Report*\n`;
  message += `Duration: ${durationStr}\n\n`;

  // Highlight key metrics
  const created = stats["Events Created"] || 0;
  const updated = stats["Events Updated"] || 0;
  const found = stats["Events Found"] || 0;
  const sources = stats["Sources Processed"] || 0;

  if (created > 0 || updated > 0) {
    message += `📊 *Results:*\n`;
    message += `• ${created} new events created\n`;
    if (updated > 0) message += `• ${updated} events updated\n`;
    message += `• ${sources} sources processed\n`;
    message += `• ${found} total events found\n`;
  } else if (found === 0 && sources > 0) {
    message += `⚠️ *No events extracted!*\n`;
    message += `• ${sources} sources were processed but no events were found\n`;
    if (hasRateLimitIssue) {
      message += `\n🚫 *Rate limit hit!* OpenRouter API rate limit was exceeded.\n`;
      message += `Consider adding credits to your OpenRouter account.\n`;
    }
  } else {
    message += `📊 *Stats:*\n`;
    Object.entries(stats).forEach(([k, v]) => {
      if (v > 0 || k.includes("Created") || k.includes("Found")) {
        message += `• ${k}: ${v}\n`;
      }
    });
  }

  // Show skipped/duplicate breakdown if relevant
  const duplicates = (stats["Duplicates (In-Run)"] || 0) + (stats["Duplicates (Exact)"] || 0) + (stats["Duplicates (Fuzzy)"] || 0);
  const skippedPast = stats["Past Events Skipped"] || 0;
  const failed = stats["Events Failed"] || 0;

  if (duplicates > 0 || skippedPast > 0 || failed > 0) {
    message += `\n📋 *Filtered out:*\n`;
    if (duplicates > 0) message += `• ${duplicates} duplicates\n`;
    if (skippedPast > 0) message += `• ${skippedPast} past events\n`;
    if (failed > 0) message += `• ${failed} failed to process\n`;
  }

  // Show errors prominently
  if (errors.length > 0) {
    message += `\n❌ *Errors (${errors.length}):*\n`;

    // Group similar errors
    const errorGroups: Record<string, number> = {};
    errors.forEach(e => {
      // Simplify error messages for grouping
      let key = e;
      if (e.includes('Rate limit')) key = 'Rate limit exceeded';
      else if (e.includes('fetch failed')) key = 'Network/fetch failed';
      else if (e.includes('timeout')) key = 'Request timeout';

      errorGroups[key] = (errorGroups[key] || 0) + 1;
    });

    Object.entries(errorGroups)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([error, count]) => {
        message += `• ${error}${count > 1 ? ` (×${count})` : ''}\n`;
      });

    if (Object.keys(errorGroups).length > 5) {
      message += `...and ${Object.keys(errorGroups).length - 5} more error types\n`;
    }
  }

  await sendSlackMessage(message);
}

export async function alertError(error: Error, context?: string): Promise<void> {
  let message = context
    ? `🚨 *Error in ${context}*\n`
    : `🚨 *Error*\n`;

  message += `\`\`\`${error.message}\`\`\``;

  // Add helpful context for known errors
  if (error.message.includes('Rate limit') || error.message.includes('429')) {
    message += `\n💡 *Tip:* This is an OpenRouter rate limit error. Add credits to your account to increase limits.`;
  }

  await sendSlackMessage(message);
}
