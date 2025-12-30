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

  const statsStr = Object.entries(stats)
    .map(([k, v]) => `• ${k}: ${v}`)
    .join("\n");

  let message = `${statusEmoji} *${agentName} Report*\n`;
  message += `Status: ${status} | Duration: ${durationStr}\n`;
  message += statsStr;

  if (errors.length > 0) {
    message += `\n\n*Errors (${errors.length}):*\n`;
    message += errors
      .slice(0, 5)
      .map((e) => `• ${e}`)
      .join("\n");
    if (errors.length > 5) {
      message += `\n...and ${errors.length - 5} more`;
    }
  }

  await sendSlackMessage(message);
}

export async function alertError(error: Error, context?: string): Promise<void> {
  const message = context
    ? `🚨 *Error in ${context}*: ${error.message}`
    : `🚨 *Error*: ${error.message}`;

  await sendSlackMessage(message);
}
