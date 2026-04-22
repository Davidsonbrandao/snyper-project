import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { normalizeStoredJson } from "../lib/json.js";
import { kvGet, kvSet } from "../lib/kv.js";
import { orgProfilesKey, resolveOrgId } from "../lib/tenant.js";

export const profilesRoute = new Hono();

profilesRoute.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const profiles = normalizeStoredJson(await kvGet(orgProfilesKey(orgId)), []);
  return c.json({ profiles });
});

profilesRoute.post("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const body = await c.req.json();
  await kvSet(orgProfilesKey(orgId), JSON.stringify(body.profiles || []));
  return c.json({ success: true });
});
