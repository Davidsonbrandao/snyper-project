import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { kvDel, kvGet, kvSet } from "../lib/kv.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";
import {
  legacyTeamKey,
  orgTeamKey,
  resolveOrgId,
} from "../lib/tenant.js";

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

async function loadMembersForOrg(orgId: string, userEmail?: string | undefined) {
  let members = parseMembers(await kvGet(orgTeamKey(orgId)));

  if (members.length === 0) {
    const legacyMembers = parseMembers(await kvGet(legacyTeamKey(orgId)));
    const userIsAdmin = legacyMembers.some(
      (member) =>
        member.role === "admin" &&
        member.email?.toLowerCase() === userEmail?.toLowerCase(),
    );

    if (legacyMembers.length > 0 && (userIsAdmin || orgId)) {
      members = legacyMembers;
      await kvSet(orgTeamKey(orgId), JSON.stringify(members));
    }
  }

  if (members.length === 0) {
    const sharedLegacyMembers = parseMembers(await kvGet("team_members"));
    const userIsAdmin = sharedLegacyMembers.some(
      (member) =>
        member.role === "admin" &&
        member.email?.toLowerCase() === userEmail?.toLowerCase(),
    );

    if (sharedLegacyMembers.length > 0 && userIsAdmin) {
      members = sharedLegacyMembers;
      await kvSet(orgTeamKey(orgId), JSON.stringify(members));
    }
  }

  return members;
}

export const teamRoute = new Hono();

teamRoute.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const members = await loadMembersForOrg(orgId, user.email);
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

  const supabase = getSupabaseAdminClient();
  const { data: newUser, error } = await supabase.auth.admin.createUser({
    email,
    user_metadata: { name, phone, profileId, orgId },
    email_confirm: true,
  });

  if (error || !newUser.user) {
    return c.json({ error: error?.message || "Erro ao criar usuario" }, 400);
  }

  await kvSet(`user_org_${newUser.user.id}`, orgId);

  const members = await loadMembersForOrg(orgId, user.email);
  const newMember: TeamMember = {
    id: newUser.user.id,
    name,
    email,
    phone,
    role: "member",
    status: "invited",
    createdAt: new Date().toISOString(),
    profileId: profileId || "",
  };

  members.push(newMember);
  await kvSet(orgTeamKey(orgId), JSON.stringify(members));

  return c.json({ member: newMember });
});

teamRoute.delete("/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const memberId = c.req.param("id");
  const orgId = await resolveOrgId(user.id);
  const members = await loadMembersForOrg(orgId, user.email);

  if (!members.some((member) => member.id === memberId)) {
    return c.json({ error: "Membro nao encontrado nesta organizacao" }, 403);
  }

  if (memberId === user.id) {
    return c.json({ error: "Voce nao pode remover a si mesmo" }, 400);
  }

  const supabase = getSupabaseAdminClient();
  await supabase.auth.admin.deleteUser(memberId);
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
  const members = await loadMembersForOrg(orgId, user.email);

  const updated = members.map((member) =>
    member.id === memberId
      ? { ...member, profileId: sanitizeString(profileId, 50) || "" }
      : member,
  );

  await kvSet(orgTeamKey(orgId), JSON.stringify(updated));

  const supabase = getSupabaseAdminClient();
  await supabase.auth.admin.updateUserById(memberId, {
    user_metadata: { profileId: sanitizeString(profileId, 50) || "" },
  });

  return c.json({ success: true });
});
