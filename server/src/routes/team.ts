import crypto from "node:crypto";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { getAuthUser } from "../lib/auth.js";
import { kvDel, kvGet, kvSet } from "../lib/kv.js";
import {
  createInviteToken,
  hashInviteToken,
  removeUser,
  updateUserById,
  upsertUser,
} from "../lib/state.js";
import { orgTeamKey, resolveOrgId } from "../lib/tenant.js";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "member";
  status: "active" | "invited";
  createdAt: string;
  profileId?: string;
}

function sanitizeString(value: unknown, maxLen = 255) {
  return typeof value === "string" ? value.trim().slice(0, maxLen) : "";
}

function sanitizeEmail(value: unknown) {
  const email = sanitizeString(value, 254).toLowerCase();
  const emailRegex = /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
  return emailRegex.test(email) ? email : "";
}

function parseMembers(data: unknown): TeamMember[] {
  if (!data) return [];
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as TeamMember[];
    } catch {
      return [];
    }
  }
  return Array.isArray(data) ? (data as TeamMember[]) : [];
}

function buildCurrentMember(user: any): TeamMember {
  return {
    id: user.id,
    name:
      sanitizeString(user.user_metadata?.name) ||
      sanitizeString(user.user_metadata?.nickname) ||
      sanitizeString(user.email) ||
      "Usuario",
    email: sanitizeString(user.email),
    phone: sanitizeString(user.user_metadata?.phone, 30),
    role: user.role === "superadmin" ? "admin" : "member",
    status: "active",
    createdAt: user.created_at || new Date().toISOString(),
    profileId: sanitizeString(user.user_metadata?.profileId, 50),
  };
}

async function loadMembersForOrg(orgId: string, currentUser?: any) {
  let members = parseMembers(await kvGet(orgTeamKey(orgId)));

  if (members.length === 0 && currentUser) {
    members = [buildCurrentMember(currentUser)];
    await kvSet(orgTeamKey(orgId), JSON.stringify(members));
  }

  return members;
}

function buildActivationLink(email: string, inviteToken: string) {
  const url = new URL("/login", env.APP_URL);
  url.searchParams.set("invite", inviteToken);
  url.searchParams.set("email", email);
  return url.toString();
}

export const teamRoute = new Hono();

teamRoute.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const members = await loadMembersForOrg(orgId, user);
  return c.json({ members });
});

teamRoute.post("/invite", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const body = await c.req.json();
  const name = sanitizeString(body.name, 100);
  const email = sanitizeEmail(body.email);
  const phone = sanitizeString(body.phone, 30);
  const profileId = sanitizeString(body.profileId, 50);

  if (!name || !email) {
    return c.json({ error: "Nome e e-mail valido sao obrigatorios" }, 400);
  }

  const currentMembers = await loadMembersForOrg(orgId, user);
  const existingMember = currentMembers.find(
    (member) => member.email.toLowerCase() === email.toLowerCase(),
  );

  if (existingMember && existingMember.status === "active") {
    return c.json({ error: "Este e-mail ja esta cadastrado no sistema" }, 400);
  }

  const inviteToken = createInviteToken();
  const inviteTokenExpiresAt = new Date(
    Date.now() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const memberId = existingMember?.id || crypto.randomUUID();
  const userRecord = existingMember
    ? await updateUserById(memberId, (current) => ({
        ...current,
        email,
        orgId,
        role: "member",
        status: "invited",
        passwordHash: current.passwordHash,
        passwordSalt: current.passwordSalt,
        inviteTokenHash: hashInviteToken(inviteToken),
        inviteTokenExpiresAt,
        userMetadata: {
          ...(current.userMetadata || {}),
          name,
          phone,
          profileId,
          orgId,
        },
      }))
    : await upsertUser({
        id: memberId,
        email,
        createdAt: new Date().toISOString(),
        lastSignInAt: null,
        role: "member",
        status: "invited",
        orgId,
        inviteTokenHash: hashInviteToken(inviteToken),
        inviteTokenExpiresAt,
        userMetadata: {
          name,
          phone,
          profileId,
          orgId,
        },
      });

  const member: TeamMember = {
    id: memberId,
    name,
    email,
    phone,
    role: "member",
    status: "invited",
    createdAt: userRecord?.createdAt || new Date().toISOString(),
    profileId: profileId || "",
  };

  const members = currentMembers.filter((item) => item.id !== memberId);
  members.push(member);
  await kvSet(orgTeamKey(orgId), JSON.stringify(members));

  return c.json({
    member,
    activationLink: buildActivationLink(email, inviteToken),
  });
});

teamRoute.delete("/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const memberId = c.req.param("id");
  const orgId = await resolveOrgId(user.id);
  const members = await loadMembersForOrg(orgId, user);

  if (!members.some((member) => member.id === memberId)) {
    return c.json({ error: "Membro nao encontrado nesta organizacao" }, 403);
  }

  if (memberId === user.id) {
    return c.json({ error: "Voce nao pode remover a si mesmo" }, 400);
  }

  await removeUser(memberId);
  await kvDel(`user_org_${memberId}`);

  const updated = members.filter((member) => member.id !== memberId);
  await kvSet(orgTeamKey(orgId), JSON.stringify(updated));

  return c.json({ success: true });
});

teamRoute.put("/:id/profile", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const memberId = c.req.param("id");
  const { profileId } = await c.req.json();
  const orgId = await resolveOrgId(user.id);
  const members = await loadMembersForOrg(orgId, user);

  const updated = members.map((member) =>
    member.id === memberId
      ? { ...member, profileId: sanitizeString(profileId, 50) || "" }
      : member,
  );

  await kvSet(orgTeamKey(orgId), JSON.stringify(updated));

  await updateUserById(memberId, (current) => ({
    ...current,
    userMetadata: {
      ...(current.userMetadata || {}),
      profileId: sanitizeString(profileId, 50) || "",
    },
  }));

  return c.json({ success: true });
});
