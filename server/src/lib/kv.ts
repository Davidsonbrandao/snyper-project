import { env } from "../config/env.js";
import { getSupabaseAdminClient } from "./supabase.js";

function parseStoredValue(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function kvGet(key: string) {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from(env.SUPABASE_KV_TABLE)
    .select("value")
    .eq("key", key)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return parseStoredValue(data?.value);
}

export async function kvSet(key: string, value: unknown) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from(env.SUPABASE_KV_TABLE)
    .upsert({ key, value });

  if (error) {
    throw new Error(error.message);
  }
}

export async function kvDel(key: string) {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from(env.SUPABASE_KV_TABLE)
    .delete()
    .eq("key", key);

  if (error) {
    throw new Error(error.message);
  }
}
