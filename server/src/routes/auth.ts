import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import {
  createSession,
  findSessionByToken,
  findUserByEmail,
  findUserByInviteToken,
  revokeSession,
  updateUserById,
  verifyPassword,
} from "../lib/state.js";

function normalizeProfileField(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getAccessTokenFromRequest(c: any) {
  return (
    c.req.header("X-User-Token") ||
    c.req.header("Authorization")?.replace(/^Bearer\s+/i, "")
  );
}

function toAuthUser(user: any) {
  return {
    id: user.id,
    email: user.email,
    created_at: user.createdAt,
    last_sign_in_at: user.lastSignInAt ?? null,
    user_metadata: user.userMetadata ?? {},
    role: user.role,
    orgId: user.orgId,
    status: user.status,
  };
}

function buildSessionPayload(user: any, token: string, expiresAt: string) {
  return {
    user: toAuthUser(user),
    session: {
      access_token: token,
      expires_at: expiresAt,
      user: toAuthUser(user),
    },
  };
}

export const authRoute = new Hono();

authRoute.post("/login", async (c) => {
  try {
    const body = await c.req.json();
    const email = normalizeProfileField(body?.email).toLowerCase();
    const password = typeof body?.password === "string" ? body.password : "";

    if (!email || !password) {
      return c.json({ error: "E-mail e senha sao obrigatorios" }, 400);
    }

    const user = await findUserByEmail(email);
    if (!user || user.status === "disabled") {
      return c.json({ error: "Credenciais invalidas" }, 401);
    }

    if (!user.passwordHash || !user.passwordSalt) {
      return c.json(
        {
          error:
            "Esta conta foi criada por convite. Use o link de ativacao enviado pelo administrador.",
        },
        400,
      );
    }

    if (!verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      return c.json({ error: "Credenciais invalidas" }, 401);
    }

    const session = await createSession(user.id);
    const updatedUser = await updateUserById(user.id, (current) => ({
      ...current,
      lastSignInAt: new Date().toISOString(),
    }));

    if (!updatedUser) {
      return c.json({ error: "Usuario nao encontrado" }, 404);
    }

    return c.json(buildSessionPayload(updatedUser, session.token, session.expiresAt));
  } catch (error) {
    console.error("Login route error:", error);
    return c.json({ error: "Erro ao autenticar" }, 500);
  }
});

authRoute.post("/accept-invite", async (c) => {
  try {
    const body = await c.req.json();
    const inviteToken = normalizeProfileField(body?.inviteToken);

    if (!inviteToken) {
      return c.json({ error: "inviteToken required" }, 400);
    }

    const invitedUser = await findUserByInviteToken(inviteToken);
    if (!invitedUser) {
      return c.json({ error: "Convite invalido ou expirado" }, 400);
    }

    const session = await createSession(invitedUser.id);
    const updatedUser = await updateUserById(invitedUser.id, (current) => ({
      ...current,
      status: "active",
      lastSignInAt: new Date().toISOString(),
      inviteTokenHash: null,
      inviteTokenExpiresAt: null,
    }));

    if (!updatedUser) {
      return c.json({ error: "Usuario nao encontrado" }, 404);
    }

    return c.json(buildSessionPayload(updatedUser, session.token, session.expiresAt));
  } catch (error) {
    console.error("Accept invite route error:", error);
    return c.json({ error: "Erro ao ativar convite" }, 500);
  }
});

authRoute.get("/me", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const accessToken = getAccessTokenFromRequest(c);
  const session = accessToken ? await findSessionByToken(accessToken) : null;

  return c.json({
    user,
    session: session
      ? {
          access_token: accessToken,
          expires_at: session.expiresAt,
          user,
        }
      : null,
  });
});

authRoute.post("/logout", async (c) => {
  const accessToken = getAccessTokenFromRequest(c);
  if (accessToken) {
    await revokeSession(accessToken);
  }

  return c.json({ success: true });
});

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

    const updatedUser = await updateUserById(user.id, (current) => ({
      ...current,
      userMetadata: {
        ...(current.userMetadata || {}),
        name,
        nickname,
        phone,
        avatar_url: avatarUrl,
      },
    }));

    if (!updatedUser) {
      return c.json({ error: "Usuario nao encontrado" }, 404);
    }

    return c.json({
      success: true,
      user: toAuthUser(updatedUser),
    });
  } catch (error) {
    console.error("Profile update route error:", error);
    return c.json({ error: `Erro ao atualizar perfil: ${error}` }, 500);
  }
});
