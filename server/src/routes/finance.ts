import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { kvGet, kvSet } from "../lib/kv.js";
import {
  legacyFinanceKey,
  orgFinanceKey,
  resolveOrgId,
} from "../lib/tenant.js";

function normalizeFinanceData(data: unknown) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  return data;
}

export const financeRoute = new Hono();

financeRoute.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);

  let financeData = normalizeFinanceData(await kvGet(orgFinanceKey(orgId)));

  if (!financeData) {
    const legacyData = normalizeFinanceData(await kvGet(legacyFinanceKey(orgId)));
    if (legacyData) {
      financeData = legacyData;
      await kvSet(orgFinanceKey(orgId), JSON.stringify(legacyData));
    }
  }

  if (!financeData) {
    financeData = normalizeFinanceData(await kvGet("finance_data"));
  }

  return c.json({ financeData });
});

financeRoute.post("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);
  const financeData = await c.req.json();

  const serialized = JSON.stringify(financeData);

  if (serialized.length > 500_000) {
    console.log(
      `Warning: finance data for org ${orgId} is ${(serialized.length / 1024).toFixed(0)}KB`,
    );
  }

  await kvSet(orgFinanceKey(orgId), serialized);

  return c.json({ success: true });
});
