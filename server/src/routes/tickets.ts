import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { parseArray } from "../lib/collections.js";
import { kvGet, kvSet } from "../lib/kv.js";
import { allTicketsKey, resolveOrgId } from "../lib/tenant.js";

export const ticketsRoute = new Hono();

ticketsRoute.post("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { subject, message, priority } = await c.req.json();
  if (!subject || !message) {
    return c.json({ error: "subject and message required" }, 400);
  }

  const orgId = await resolveOrgId(user.id);
  const userName =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name
      : user.email;
  const ticket = {
    id: `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    orgId,
    userId: user.id,
    userEmail: user.email,
    userName,
    subject,
    message,
    priority: priority || "medium",
    status: "open",
    createdAt: new Date().toISOString(),
    responses: [],
  };

  const tickets = parseArray<any>(await kvGet(allTicketsKey()));
  tickets.unshift(ticket);
  await kvSet(allTicketsKey(), JSON.stringify(tickets));

  return c.json({ ticket });
});
