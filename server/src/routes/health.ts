import { Hono } from "hono";
import { env } from "../config/env.js";

export const healthRoute = new Hono();

healthRoute.get("/", (c) => {
  return c.json({
    ok: true,
    service: env.APP_NAME,
    environment: env.NODE_ENV,
    now: new Date().toISOString(),
  });
});
