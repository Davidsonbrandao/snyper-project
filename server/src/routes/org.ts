import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { resolveOrgId } from "../lib/tenant.js";

export const orgRoute = new Hono();

orgRoute.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const orgId = await resolveOrgId(user.id);

  return c.json({
    orgId,
    isOwner: orgId === user.id,
  });
});
