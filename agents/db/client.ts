import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { config } from "../config";
import type { Database } from "../../types/database";

let _supabase: SupabaseClient<Database> | null = null;

export function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    _supabase = createClient<Database>(config.supabaseUrl, config.supabaseServiceKey);
  }
  return _supabase;
}
