import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { normalizeStoredJson } from "../lib/json.js";
import { kvGet, kvSet } from "../lib/kv.js";
import {
  orgInvoiceConfigKey,
  orgInvoicesKey,
  resolveOrgId,
} from "../lib/tenant.js";

export const invoicesRoute = new Hono();

invoicesRoute.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const invoices = normalizeStoredJson(await kvGet(orgInvoicesKey(orgId)), []);
  return c.json({ invoices });
});

invoicesRoute.post("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const { invoices } = await c.req.json();
  await kvSet(orgInvoicesKey(orgId), JSON.stringify(invoices || []));
  return c.json({ success: true });
});

invoicesRoute.get("/config", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const config = normalizeStoredJson(await kvGet(orgInvoiceConfigKey(orgId)), null);
  return c.json({ config });
});

invoicesRoute.post("/config", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const { config } = await c.req.json();
  await kvSet(orgInvoiceConfigKey(orgId), JSON.stringify(config || null));
  return c.json({ success: true });
});
