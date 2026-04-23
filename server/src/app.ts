import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { env, allowedOrigins } from "./config/env.js";
import { adminRoute } from "./routes/admin.js";
import { authRoute } from "./routes/auth.js";
import { financeRoute } from "./routes/finance.js";
import { healthRoute } from "./routes/health.js";
import { invoicesRoute } from "./routes/invoices.js";
import { orgRoute } from "./routes/org.js";
import { profilesRoute } from "./routes/profiles.js";
import { teamRoute } from "./routes/team.js";
import { ticketsRoute } from "./routes/tickets.js";
import { themeRoute } from "./routes/theme.js";
import { uploadRoute } from "./routes/upload.js";

export function createApp() {
  const app = new Hono();

  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return null;
        return allowedOrigins.includes(origin) ? origin : null;
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-User-Token"],
      credentials: true,
    }),
  );

  app.get("/", (c) =>
    c.json({
      ok: true,
      service: env.APP_NAME,
      message: "Backend proprio do Snyper em preparacao.",
      docs: {
        health: "/health",
        org: "/org",
        finance: "/finance",
        team: "/team",
        profiles: "/profiles",
        theme: "/theme",
        invoices: "/invoices",
        tickets: "/tickets",
        admin: "/admin",
        upload: "/upload",
        auth: "/auth",
      },
    }),
  );

  app.route("/health", healthRoute);
  app.route("/auth", authRoute);
  app.route("/admin", adminRoute);
  app.route("/org", orgRoute);
  app.route("/finance", financeRoute);
  app.route("/team", teamRoute);
  app.route("/profiles", profilesRoute);
  app.route("/theme", themeRoute);
  app.route("/invoices", invoicesRoute);
  app.route("/tickets", ticketsRoute);
  app.route("/upload", uploadRoute);

  app.notFound((c) =>
    c.json(
      {
        ok: false,
        error: "Rota nao encontrada",
      },
      404,
    ),
  );

  app.onError((error, c) => {
    console.error(error);
    return c.json(
      {
        ok: false,
        error: "Erro interno do servidor",
      },
      500,
    );
  });

  return app;
}
