import type { Context } from "hono";
import { getSupabaseAdminClient } from "./supabase.js";

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  userMetadata?: Record<string, unknown>;
}

export async function getAuthUser(c: Context): Promise<AuthUser | null> {
  const accessToken =
    c.req.header("X-User-Token") ||
    c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");

  if (!accessToken) {
    return null;
  }

  const supabase = getSupabaseAdminClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    name: typeof user.user_metadata?.name === "string" ? user.user_metadata.name : undefined,
    userMetadata: user.user_metadata ?? {},
  };
}

export async function requireAuth(c: any, next: any) {
  const user = await getAuthUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}
