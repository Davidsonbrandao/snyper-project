import crypto from "node:crypto";
import { Hono } from "hono";
import { env } from "../config/env.js";
import type { AuthUser } from "../lib/auth.js";
import { getAuthUser } from "../lib/auth.js";
import { normalizeStoredJson } from "../lib/json.js";
import { kvDel, kvGet, kvSet } from "../lib/kv.js";
import {
  createInviteToken,
  hashInviteToken,
  updateUserById,
  upsertUser,
} from "../lib/state.js";
import {
  allCouponsKey,
  allPlansKey,
  allTenantsKey,
  allTicketsKey,
  couponKey,
  orgTeamKey,
  tenantKey,
} from "../lib/tenant.js";

const ADMIN_EMAIL = env.BOOTSTRAP_ADMIN_EMAIL || "admin@snyper.local";

function isSuperAdmin(user: AuthUser | null) {
  return (
    user?.role === "superadmin" ||
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()
  );
}

async function requireSuperAdmin(c: any) {
  const user = await getAuthUser(c);
  if (!user || !isSuperAdmin(user)) {
    c.status(403);
    return null;
  }
  return user;
}

function parseArray<T>(data: unknown) {
  return normalizeStoredJson<T[]>(data, []);
}

export const adminRoute = new Hono();

adminRoute.get("/coupons", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  return c.json({ coupons: parseArray(await kvGet(allCouponsKey())) });
});

adminRoute.post("/coupons", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);

  const body = await c.req.json();
  const code = String(body.code || "").trim().toUpperCase();
  const discountPercent = Number(body.discountPercent || 0);

  if (!code || !discountPercent) {
    return c.json({ error: "code and discountPercent required" }, 400);
  }

  const currentCoupons = parseArray<any>(await kvGet(allCouponsKey()));
  const existingIndex = currentCoupons.findIndex((coupon) => coupon.code === code);
  const coupon = {
    code,
    discountPercent,
    expiresAt: body.expiresAt || null,
    maxUses: body.maxUses || null,
    usedCount: existingIndex >= 0 ? currentCoupons[existingIndex].usedCount || 0 : 0,
    active: typeof body.active === "boolean" ? body.active : true,
    description: body.description || "",
    createdAt: existingIndex >= 0 ? currentCoupons[existingIndex].createdAt : new Date().toISOString(),
  };

  await kvSet(couponKey(code), JSON.stringify(coupon));

  if (existingIndex >= 0) {
    currentCoupons[existingIndex] = coupon;
  } else {
    currentCoupons.push(coupon);
  }

  await kvSet(allCouponsKey(), JSON.stringify(currentCoupons));
  return c.json({ coupon });
});

adminRoute.delete("/coupons/:code", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const code = c.req.param("code").toUpperCase();
  await kvDel(couponKey(code));
  const filtered = parseArray<any>(await kvGet(allCouponsKey())).filter((coupon) => coupon.code !== code);
  await kvSet(allCouponsKey(), JSON.stringify(filtered));
  return c.json({ success: true });
});

adminRoute.get("/tickets", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  return c.json({ tickets: parseArray(await kvGet(allTicketsKey())) });
});

adminRoute.put("/tickets/:id", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const ticketId = c.req.param("id");
  const updates = await c.req.json();
  const tickets = parseArray<any>(await kvGet(allTicketsKey()));
  const index = tickets.findIndex((ticket) => ticket.id === ticketId);
  if (index === -1) {
    return c.json({ error: "Ticket not found" }, 404);
  }
  tickets[index] = { ...tickets[index], ...updates };
  await kvSet(allTicketsKey(), JSON.stringify(tickets));
  return c.json({ ticket: tickets[index] });
});

adminRoute.get("/stats", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);

  const tenantRefs = parseArray<any>(await kvGet(allTenantsKey()));
  const tenantDetails = [];

  for (const tenantRef of tenantRefs) {
    const detail = await kvGet(tenantKey(tenantRef.id));
    if (detail) {
      tenantDetails.push(normalizeStoredJson(detail, tenantRef));
    }
  }

  const tickets = parseArray<any>(await kvGet(allTicketsKey()));
  const stats = {
    totalTenants: tenantDetails.length,
    activeTenants: tenantDetails.filter((tenant) => tenant.status === "active").length,
    trialTenants: tenantDetails.filter((tenant) => tenant.status === "trial").length,
    pausedTenants: tenantDetails.filter((tenant) => tenant.status === "paused").length,
    expiredTenants: tenantDetails.filter((tenant) => tenant.status === "expired").length,
    basicPlan: tenantDetails.filter((tenant) => tenant.plan === "basic").length,
    premiumPlan: tenantDetails.filter((tenant) => tenant.plan === "premium").length,
    totalUsers: tenantDetails.reduce((sum, tenant) => sum + (tenant.activeUsers || 1), 0),
    openTickets: tickets.filter((ticket) => ticket.status === "open").length,
    totalTickets: tickets.length,
    monthlyRevenue: tenantDetails
      .filter((tenant) => tenant.status === "active")
      .reduce((sum, tenant) => {
        const base = tenant.plan === "premium" ? 197 : 97;
        return sum + base * (1 - (tenant.discount || 0) / 100);
      }, 0),
  };

  return c.json({ stats, tenants: tenantDetails, tickets });
});

adminRoute.get("/plans", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  return c.json({ plans: parseArray(await kvGet(allPlansKey())) });
});

adminRoute.post("/plans", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const { plans } = await c.req.json();
  await kvSet(allPlansKey(), JSON.stringify(plans || []));
  return c.json({ success: true });
});

adminRoute.get("/tenants", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  return c.json({ tenants: parseArray(await kvGet(allTenantsKey())) });
});

adminRoute.post("/tenants", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const body = await c.req.json();
  const companyName = body.companyName;
  const ownerName = body.ownerName;
  const ownerEmail = body.ownerEmail;

  if (!companyName || !ownerName || !ownerEmail) {
    return c.json({ error: "companyName, ownerName, ownerEmail are required" }, 400);
  }

  const now = new Date();
  const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const tenant = {
    id: pendingId,
    companyName,
    cnpj: body.cnpj || "",
    ownerName,
    ownerEmail,
    ownerPhone: body.ownerPhone || "",
    planId: body.planId || "",
    plan: "basic",
    status: "pending",
    trialDays: body.trialDays || 0,
    trialEnd: null,
    createdAt: now.toISOString(),
    activeUsers: 0,
    maxUsers: 5,
    discount: 0,
    couponCode: body.couponCode || null,
    extraDays: 0,
    notes: body.notes || "",
    storageUsageMB: 0,
    lastActiveAt: null,
    sentAt: null,
  };

  await kvSet(tenantKey(pendingId), JSON.stringify(tenant));
  const allTenants = parseArray<any>(await kvGet(allTenantsKey()));
  allTenants.push({
    id: pendingId,
    companyName,
    ownerEmail,
    createdAt: now.toISOString(),
  });
  await kvSet(allTenantsKey(), JSON.stringify(allTenants));
  return c.json({ tenant });
});

adminRoute.put("/tenants/:id", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const tenantId = c.req.param("id");
  const updates = await c.req.json();
  const tenant = normalizeStoredJson(await kvGet(tenantKey(tenantId)), null as any);

  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }

  const updated = { ...tenant, ...updates, id: tenantId };
  if (updates.addDays && typeof updates.addDays === "number") {
    const currentEnd = tenant.trialEnd ? new Date(tenant.trialEnd) : new Date();
    currentEnd.setDate(currentEnd.getDate() + updates.addDays);
    updated.trialEnd = currentEnd.toISOString();
    updated.extraDays = (tenant.extraDays || 0) + updates.addDays;
    if (updated.status === "expired") updated.status = "trial";
    delete updated.addDays;
  }

  await kvSet(tenantKey(tenantId), JSON.stringify(updated));
  return c.json({ tenant: updated });
});

adminRoute.delete("/tenants/:id", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const tenantId = c.req.param("id");
  await kvDel(tenantKey(tenantId));
  const filtered = parseArray<any>(await kvGet(allTenantsKey())).filter((tenant) => tenant.id !== tenantId);
  await kvSet(allTenantsKey(), JSON.stringify(filtered));
  return c.json({ success: true });
});

adminRoute.get("/tenants/:id", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const tenantId = c.req.param("id");
  const tenant = normalizeStoredJson(await kvGet(tenantKey(tenantId)), null as any);
  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }
  const members = parseArray<any>(await kvGet(orgTeamKey(tenantId)));
  tenant.activeUsers = members.filter((member) => member.status !== "removed").length;
  return c.json({ tenant, members });
});

adminRoute.put("/tenants/:tenantId/users/:userId", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const tenantId = c.req.param("tenantId");
  const userId = c.req.param("userId");
  const { email, name, status } = await c.req.json();
  const updatedUser = await updateUserById(userId, (current) => ({
    ...current,
    email: email || current.email,
    status: status || current.status,
    userMetadata: {
      ...(current.userMetadata || {}),
      ...(name ? { name } : {}),
    },
  }));

  if (!updatedUser) {
    return c.json({ error: "Usuario nao encontrado" }, 404);
  }

  const members = parseArray<any>(await kvGet(orgTeamKey(tenantId)));
  const index = members.findIndex((member) => member.id === userId);
  if (index >= 0) {
    if (name) members[index].name = name;
    if (email) members[index].email = email;
    if (status) members[index].status = status;
    await kvSet(orgTeamKey(tenantId), JSON.stringify(members));
  }

  return c.json({ success: true });
});

adminRoute.post("/tenants/:id/send-license", async (c) => {
  if (!(await requireSuperAdmin(c))) return c.json({ error: "Forbidden" }, 403);
  const tenantId = c.req.param("id");
  const tenant = normalizeStoredJson(await kvGet(tenantKey(tenantId)), null as any);

  if (!tenant) {
    return c.json({ error: "Tenant not found" }, 404);
  }
  if (tenant.status !== "pending") {
    return c.json({ error: "Licenca ja enviada para esta empresa" }, 400);
  }

  const inviteToken = createInviteToken();
  const realTenantId = crypto.randomUUID();
  const now = new Date();
  const trialDays = tenant.trialDays || 0;
  const trialEnd =
    trialDays > 0 ? new Date(now.getTime() + trialDays * 24 * 60 * 60 * 1000).toISOString() : null;

  let discount = 0;
  if (tenant.couponCode) {
    const coupon = normalizeStoredJson(await kvGet(couponKey(String(tenant.couponCode).toUpperCase())), null as any);
    if (coupon && coupon.active && (!coupon.expiresAt || coupon.expiresAt > now.toISOString())) {
      discount = coupon.discountPercent || 0;
      coupon.usedCount = (coupon.usedCount || 0) + 1;
      await kvSet(couponKey(String(tenant.couponCode).toUpperCase()), JSON.stringify(coupon));
    }
  }

  await upsertUser({
    id: realTenantId,
    email: String(tenant.ownerEmail).toLowerCase(),
    createdAt: now.toISOString(),
    lastSignInAt: null,
    role: "superadmin",
    status: "invited",
    orgId: realTenantId,
    inviteTokenHash: hashInviteToken(inviteToken),
    inviteTokenExpiresAt: new Date(
      now.getTime() + env.INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
    userMetadata: {
      name: tenant.ownerName,
      companyName: tenant.companyName,
      ownerPhone: tenant.ownerPhone || "",
      orgId: realTenantId,
    },
  });

  const updatedTenant = {
    ...tenant,
    id: realTenantId,
    status: trialDays > 0 ? "trial" : "active",
    trialEnd,
    discount,
    sentAt: now.toISOString(),
    activeUsers: 1,
  };

  if (tenantId !== realTenantId) {
    await kvDel(tenantKey(tenantId));
  }
  await kvSet(tenantKey(realTenantId), JSON.stringify(updatedTenant));

  const allTenants = parseArray<any>(await kvGet(allTenantsKey()));
  const index = allTenants.findIndex((tenantRef) => tenantRef.id === tenantId);
  if (index >= 0) {
    allTenants[index] = { ...allTenants[index], id: realTenantId };
    await kvSet(allTenantsKey(), JSON.stringify(allTenants));
  }

  await kvSet(`user_org_${realTenantId}`, realTenantId);
  await kvSet(
    orgTeamKey(realTenantId),
    JSON.stringify([
      {
        id: realTenantId,
        name: tenant.ownerName,
        email: tenant.ownerEmail,
        phone: tenant.ownerPhone || "",
        role: "admin",
        status: "invited",
        createdAt: now.toISOString(),
      },
    ]),
  );

  return c.json({
    tenant: updatedTenant,
    activationLink: `${env.APP_URL}/login?invite=${encodeURIComponent(inviteToken)}&email=${encodeURIComponent(String(tenant.ownerEmail))}`,
  });
});
