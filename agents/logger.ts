import { createClient } from "@supabase/supabase-js";
import { config } from "./config";
import type { Database, AgentRunInsert, AgentLogInsert } from "../types/database";

const supabase = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey);

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';
export type AgentType = 'extraction' | 'discovery';
export type AgentStatus = 'running' | 'completed' | 'failed';

export class AgentLogger {
  private runId: string | null = null;
  private agentType: AgentType;
  private startTime: Date;

  constructor(agentType: AgentType) {
    this.agentType = agentType;
    this.startTime = new Date();
  }

  /**
   * Start a new agent run
   */
  async startRun(): Promise<string | null> {
    try {
      const runData: AgentRunInsert = {
        agent_type: this.agentType,
        status: 'running',
        started_at: this.startTime.toISOString(),
        stats: {},
      };

      const { data, error } = await supabase
        .from('agent_runs')
        .insert(runData)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to create agent run:', error);
        return null;
      }

      this.runId = data.id;
      await this.log('info', `Started ${this.agentType} agent`);
      return this.runId;
    } catch (error) {
      console.error('Failed to start agent run:', error);
      return null;
    }
  }

  /**
   * Log a message to the database
   */
  async log(level: LogLevel, message: string, metadata?: Record<string, unknown>): Promise<void> {
    // Also log to console
    const prefix = `[${level.toUpperCase()}]`;
    console.log(`${prefix} ${message}`);

    if (!this.runId) {
      return; // Run not initialized, only log to console
    }

    try {
      const logData: AgentLogInsert = {
        agent_run_id: this.runId,
        level,
        message,
        metadata: metadata || null,
      };

      const { error } = await supabase.from('agent_logs').insert(logData);

      if (error) {
        console.error('Failed to insert log:', error);
      }
    } catch (error) {
      console.error('Failed to log to database:', error);
    }
  }

  /**
   * Update the agent run status and stats
   */
  async completeRun(status: 'completed' | 'failed', stats: Record<string, unknown>, summary?: string, errorMessage?: string): Promise<void> {
    if (!this.runId) return;

    try {
      const durationSeconds = Math.floor((Date.now() - this.startTime.getTime()) / 1000);

      const { error } = await supabase
        .from('agent_runs')
        .update({
          status,
          completed_at: new Date().toISOString(),
          duration_seconds: durationSeconds,
          stats,
          summary: summary || null,
          error_message: errorMessage || null,
        })
        .eq('id', this.runId);

      if (error) {
        console.error('Failed to update agent run:', error);
      }

      await this.log(
        status === 'completed' ? 'success' : 'error',
        `${this.agentType} agent ${status} in ${durationSeconds}s`
      );
    } catch (error) {
      console.error('Failed to complete agent run:', error);
    }
  }

  /**
   * Convenience methods for different log levels
   */
  async info(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('info', message, metadata);
  }

  async warn(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('warn', message, metadata);
  }

  async error(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('error', message, metadata);
  }

  async debug(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('debug', message, metadata);
  }

  async success(message: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.log('success', message, metadata);
  }
}
