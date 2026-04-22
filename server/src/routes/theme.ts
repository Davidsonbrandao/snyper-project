import { Hono } from "hono";
import { getAuthUser } from "../lib/auth.js";
import { kvGet, kvSet } from "../lib/kv.js";
import { userThemeKey } from "../lib/tenant.js";

const DEFAULT_THEME = { mode: "dark", accent: "#FF0074" };

function normalizeTheme(data: unknown) {
  if (!data) return DEFAULT_THEME;
  if (typeof data === "string") {
    try {
      return JSON.parse(data);
    } catch {
      return DEFAULT_THEME;
    }
  }
  return data;
}

export const themeRoute = new Hono();

themeRoute.get("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const theme = normalizeTheme(await kvGet(userThemeKey(user.id)));
  return c.json(theme || DEFAULT_THEME);
});

themeRoute.post("/", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const { mode, accent } = await c.req.json();
  await kvSet(userThemeKey(user.id), JSON.stringify({ mode, accent }));
  return c.json({ success: true });
});
