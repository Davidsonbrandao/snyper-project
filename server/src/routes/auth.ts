import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";

function normalizeProfileField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export const authRoute = new Hono();

authRoute.patch("/profile", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();
    const name = normalizeProfileField(body?.name);
    const nickname = normalizeProfileField(body?.nickname);
    const phone = normalizeProfileField(body?.phone);
    const avatarUrl = normalizeProfileField(body?.avatarUrl);

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...(user.userMetadata || {}),
        name,
        nickname,
        phone,
        avatar_url: avatarUrl,
      },
    });

    if (error) {
      return c.json(
        { error: `Erro ao atualizar perfil: ${error.message}` },
        500,
      );
    }

    return c.json({
      success: true,
      user: data.user,
    });
  } catch (error) {
    console.error("Profile update route error:", error);
    return c.json({ error: `Erro ao atualizar perfil: ${error}` }, 500);
  }
});
