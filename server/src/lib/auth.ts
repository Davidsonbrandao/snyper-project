import type { Context } from "hono";
import { findSessionByToken, findUserById } from "./state.js";

export interface AuthUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, unknown>;
  role?: "superadmin" | "admin" | "member";
  orgId?: string;
  status?: "active" | "invited" | "disabled";
}

function getAccessToken(c: Context) {
  return (
    c.req.header("X-User-Token") ||
    c.req.header("Authorization")?.replace(/^Bearer\s+/i, "")
  );
}

export async function getAuthUser(c: Context): Promise<AuthUser | null> {
  const accessToken = getAccessToken(c);
  if (!accessToken) {
    return null;
  }

  const session = await findSessionByToken(accessToken);
  if (!session) {
    return null;
  }

  const storedUser = await findUserById(session.userId);
  if (!storedUser || storedUser.status === "disabled") {
    return null;
  }

  return {
    id: storedUser.id,
    email: storedUser.email,
    created_at: storedUser.createdAt,
    last_sign_in_at: storedUser.lastSignInAt ?? null,
    user_metadata: storedUser.userMetadata ?? {},
    role: storedUser.role,
    orgId: storedUser.orgId,
    status: storedUser.status,
  };
}

export async function requireAuth(c: any, next: any) {
  const user = await getAuthUser(c);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
}
