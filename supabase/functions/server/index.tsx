import { Hono } from "npm:hono";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Admin email constant (only on server - never exposed to frontend)
const ADMIN_EMAIL = "admin@snyper.com.br";
const ADMIN_PASSWORD =
  Deno.env.get("ADMIN_PASSWORD") || "Snyper102030@@";

// ============== SECURITY: Rate Limiting ==============
const rateLimitMap = new Map<
  string,
  { count: number; resetAt: number }
>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX_AUTH = 6; // max 6 auth attempts per minute
const RATE_LIMIT_MAX_API = 120; // max 120 API calls per minute

function getRateLimitKey(c: any, prefix: string): string {
  const ip =
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ||
    c.req.header("x-real-ip") ||
    "unknown";
  return `${prefix}:${ip}`;
}

function checkRateLimit(
  key: string,
  max: number,
): { allowed: boolean; remaining: number; retryAfter: number } {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW,
    });
    return { allowed: true, remaining: max - 1, retryAfter: 0 };
  }

  if (entry.count >= max) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count++;
  return {
    allowed: true,
    remaining: max - entry.count,
    retryAfter: 0,
  };
}

// Cleanup stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) rateLimitMap.delete(key);
  }
}, 300_000);

// ============== SECURITY: Input Sanitization ==============
function sanitizeEmail(email: string): string | null {
  if (!email || typeof email !== "string") return null;
  const trimmed = email.trim().toLowerCase();
  const emailRegex =
    /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/;
  if (!emailRegex.test(trimmed)) return null;
  if (trimmed.length > 254) return null;
  return trimmed;
}

function sanitizeString(str: string, maxLen = 500): string {
  if (!str || typeof str !== "string") return "";
  return str
    .trim()
    .slice(0, maxLen)
    .replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      "",
    );
}

// Enable logger
app.use("*", logger(console.log));

// ============== SECURITY: Headers & Global Rate Limit ==============
app.use("*", async (c, next) => {
  // Security headers
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("X-XSS-Protection", "1; mode=block");
  c.header(
    "Referrer-Policy",
    "strict-origin-when-cross-origin",
  );
  c.header(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  // Global rate limit (skip auth endpoint - has its own)
  const path = c.req.path;
  if (!path.includes("/auth/") && !path.includes("/health")) {
    const rlKey = getRateLimitKey(c, "api");
    const rl = checkRateLimit(rlKey, RATE_LIMIT_MAX_API);
    if (!rl.allowed) {
      console.log(`Global rate limit exceeded from ${rlKey}`);
      return c.json(
        {
          error:
            "Limite de requisicoes excedido. Tente novamente em breve.",
        },
        429,
      );
    }
  }

  await next();
});

// ============== STORAGE INIT ==============
const DELIVERABLE_BUCKET = "make-bd920daa-deliverables";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

async function ensureBucket() {
  const supabase = getAdminClient();
  const { data: buckets } =
    await supabase.storage.listBuckets();
  const exists = buckets?.some(
    (b: any) => b.name === DELIVERABLE_BUCKET,
  );
  if (!exists) {
    await supabase.storage.createBucket(DELIVERABLE_BUCKET, {
      public: false,
    });
    console.log(`Created bucket: ${DELIVERABLE_BUCKET}`);
  }
}
ensureBucket().catch((err) =>
  console.log("Error ensuring bucket:", err),
);

// Enable CORS for all routes and methods
app.use("*", async (c, next) => {
  const requestedHeaders =
    c.req.header("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-user-token";

  c.header("Access-Control-Allow-Origin", "https://app.snyper.com.br");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", requestedHeaders);
  c.header("Access-Control-Max-Age", "86400");

  await next();
});

app.options("*", (c) => {
  const requestedHeaders =
    c.req.header("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-user-token";

  return new Response("ok", {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "https://app.snyper.com.br",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": requestedHeaders,
      "Access-Control-Max-Age": "86400",
    },
  });
});

// Helper: get authenticated user
async function getAuthUser(c: any) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const accessToken =
    c.req.header("X-User-Token") ||
    c.req.header("Authorization")?.split(" ")[1];
  if (!accessToken) return null;

  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

// Helper: get admin supabase client
function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

// ============== MULTI-TENANCY HELPERS ==============

/**
 * Resolve the organization ID for a user.
 * - If user is an org owner (admin), orgId = user.id
 * - If user is a team member, orgId = stored mapping from user_org_{userId}
 * - Fallback: orgId = user.id (first-time admin)
 */
async function resolveOrgId(userId: string): Promise<string> {
  // Check if user is mapped to an org
  const mapping = await kv.get(`user_org_${userId}`);
  if (mapping) {
    return mapping as string;
  }
  // User is an org owner (admin) – orgId = userId
  return userId;
}

function orgFinanceKey(orgId: string) {
  return `finance_data_org_${orgId}`;
}

function orgTeamKey(orgId: string) {
  return `team_members_org_${orgId}`;
}

function orgProfilesKey(orgId: string) {
  return `access_profiles_org_${orgId}`;
}

function userThemeKey(userId: string) {
  return `user_theme_${userId}`;
}

function orgInvoicesKey(orgId: string) {
  return `invoices_org_${orgId}`;
}

function orgInvoiceConfigKey(orgId: string) {
  return `invoice_config_org_${orgId}`;
}

// Legacy keys for migration
function legacyFinanceKey(userId: string) {
  return `finance_data_${userId}`;
}

function legacyTeamKey(userId: string) {
  return `team_members_${userId}`;
}

// Health check endpoint
app.get("/make-server-bd920daa/health", (c) => {
  return c.json({ status: "ok" });
});

// ============== ORG INFO ==============

app.get("/make-server-bd920daa/org", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    return c.json({ orgId, isOwner: orgId === user.id });
  } catch (err) {
    console.log("Error resolving org:", err);
    return c.json(
      { error: `Error resolving org: ${err}` },
      500,
    );
  }
});

// ============== FINANCE DATA ==============

app.get("/make-server-bd920daa/finance", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    let financeData = null;

    // Try org-scoped key first
    const data = await kv.get(orgFinanceKey(orgId));
    if (data) {
      try {
        financeData = JSON.parse(data as string);
      } catch (parseErr) {
        console.log(
          "Error parsing org finance data:",
          parseErr,
        );
      }
    }

    // Migration: try legacy per-user key
    if (!financeData) {
      const legacyData = await kv.get(legacyFinanceKey(orgId));
      if (legacyData) {
        try {
          financeData = JSON.parse(legacyData as string);
          // Migrate to org key
          await kv.set(
            orgFinanceKey(orgId),
            legacyData as string,
          );
          console.log(
            `Migrated finance data to org key for orgId=${orgId}`,
          );
        } catch (legErr) {
          console.log(
            "Error migrating legacy finance data:",
            legErr,
          );
        }
      }
    }

    // Last resort: try legacy shared key
    if (!financeData) {
      try {
        const shared = await kv.get("finance_data");
        if (shared) {
          financeData = JSON.parse(shared as string);
        }
      } catch {}
    }

    return c.json({ financeData });
  } catch (err) {
    console.log("Error fetching finance data:", err);
    return c.json(
      { error: `Error fetching finance data: ${err}` },
      500,
    );
  }
});

app.post("/make-server-bd920daa/finance", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    const financeData = await c.req.json();
    const serialized = JSON.stringify(financeData);

    if (serialized.length > 500_000) {
      console.log(
        `Warning: finance data for org ${orgId} is ${(serialized.length / 1024).toFixed(0)}KB`,
      );
    }

    await kv.set(orgFinanceKey(orgId), serialized);
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving finance data:", err);
    return c.json(
      { error: `Error saving finance data: ${err}` },
      500,
    );
  }
});

// ============== TEAM MANAGEMENT ==============

app.get("/make-server-bd920daa/team", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    let members = [];

    // Try org-scoped key
    const membersData = await kv.get(orgTeamKey(orgId));
    if (membersData) {
      members = JSON.parse(membersData as string);
    }

    // Migration: try legacy per-user key
    if (members.length === 0) {
      const legacyData = await kv.get(legacyTeamKey(orgId));
      if (legacyData) {
        const legacyMembers = JSON.parse(legacyData as string);
        const userIsAdmin = legacyMembers.some(
          (m: any) =>
            m.role === "admin" &&
            m.email?.toLowerCase() ===
              user.email?.toLowerCase(),
        );
        if (userIsAdmin || orgId === user.id) {
          members = legacyMembers;
          await kv.set(
            orgTeamKey(orgId),
            JSON.stringify(members),
          );
          console.log(
            `Migrated team_members to org key for orgId=${orgId}`,
          );
        }
      }
    }

    // Last resort legacy shared key
    if (members.length === 0) {
      try {
        const legacyData = await kv.get("team_members");
        if (legacyData) {
          const legacyMembers = JSON.parse(
            legacyData as string,
          );
          const userIsAdmin = legacyMembers.some(
            (m: any) =>
              m.role === "admin" &&
              m.email?.toLowerCase() ===
                user.email?.toLowerCase(),
          );
          if (userIsAdmin) {
            members = legacyMembers;
            await kv.set(
              orgTeamKey(orgId),
              JSON.stringify(members),
            );
          }
        }
      } catch {}
    }

    return c.json({ members });
  } catch (err) {
    console.log("Error fetching team members:", err);
    return c.json(
      { error: `Error fetching team members: ${err}` },
      500,
    );
  }
});

app.post("/make-server-bd920daa/team/invite", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    // Rate limit invites
    const rlKey = getRateLimitKey(c, "invite");
    const rl = checkRateLimit(rlKey, 10); // max 10 invites per minute
    if (!rl.allowed) {
      return c.json(
        {
          error: `Muitas solicitacoes. Tente novamente em ${rl.retryAfter}s.`,
        },
        429,
      );
    }

    const orgId = await resolveOrgId(user.id);
    const body = await c.req.json();
    const name = sanitizeString(body.name, 100);
    const emailRaw = body.email;
    const cleanEmail = sanitizeEmail(emailRaw);

    if (!name || !cleanEmail) {
      return c.json(
        { error: "Nome e e-mail valido sao obrigatorios" },
        400,
      );
    }

    const phone = sanitizeString(body.phone || "", 30);
    const profileId = sanitizeString(body.profileId || "", 50);

    const supabase = getAdminClient();

    const { data: newUser, error: createError } =
      await supabase.auth.admin.createUser({
        email: cleanEmail,
        user_metadata: { name, phone, profileId, orgId },
        email_confirm: true,
      });

    if (createError) {
      console.log("Error creating auth user:", createError);
      return c.json(
        {
          error: `Error creating user: ${createError.message}`,
        },
        400,
      );
    }

    // Map new user to the org
    await kv.set(`user_org_${newUser.user.id}`, orgId);

    // Store team member in org-scoped KV
    const membersData = await kv.get(orgTeamKey(orgId));
    const members = membersData
      ? JSON.parse(membersData as string)
      : [];

    const newMember = {
      id: newUser.user.id,
      name,
      email: cleanEmail,
      phone,
      role: "member" as const,
      status: "invited" as const,
      createdAt: new Date().toISOString(),
      profileId: profileId || "",
    };

    members.push(newMember);
    await kv.set(orgTeamKey(orgId), JSON.stringify(members));

    return c.json({ member: newMember });
  } catch (err) {
    console.log("Error inviting team member:", err);
    return c.json(
      { error: `Error inviting team member: ${err}` },
      500,
    );
  }
});

app.delete("/make-server-bd920daa/team/:id", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const memberId = c.req.param("id");

  try {
    const orgId = await resolveOrgId(user.id);

    // SECURITY: Verify the member belongs to this org before deleting
    const membersData = await kv.get(orgTeamKey(orgId));
    const members = membersData
      ? JSON.parse(membersData as string)
      : [];
    const memberExists = members.some(
      (m: any) => m.id === memberId,
    );
    if (!memberExists) {
      console.log(
        `Security: user ${user.id} tried to delete member ${memberId} not in org ${orgId}`,
      );
      return c.json(
        { error: "Membro nao encontrado nesta organizacao" },
        403,
      );
    }

    // Prevent deleting yourself (admin)
    if (memberId === user.id) {
      return c.json(
        { error: "Voce nao pode remover a si mesmo" },
        400,
      );
    }

    const supabase = getAdminClient();
    await supabase.auth.admin.deleteUser(memberId);

    // Remove org mapping
    await kv.del(`user_org_${memberId}`);

    // Remove from org team
    const updated = members.filter(
      (m: any) => m.id !== memberId,
    );
    await kv.set(orgTeamKey(orgId), JSON.stringify(updated));

    return c.json({ success: true });
  } catch (err) {
    console.log("Error removing team member:", err);
    return c.json(
      { error: `Error removing team member: ${err}` },
      500,
    );
  }
});

// Update member profile assignment
app.put("/make-server-bd920daa/team/:id/profile", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const memberId = c.req.param("id");

  try {
    const orgId = await resolveOrgId(user.id);
    const { profileId } = await c.req.json();

    const membersData = await kv.get(orgTeamKey(orgId));
    const members = membersData
      ? JSON.parse(membersData as string)
      : [];
    const updated = members.map((m: any) =>
      m.id === memberId
        ? { ...m, profileId: profileId || "" }
        : m,
    );
    await kv.set(orgTeamKey(orgId), JSON.stringify(updated));

    // Also update user_metadata in Supabase Auth
    const supabase = getAdminClient();
    await supabase.auth.admin.updateUser(memberId, {
      user_metadata: { profileId },
    });

    return c.json({ success: true });
  } catch (err) {
    console.log("Error updating member profile:", err);
    return c.json(
      { error: `Error updating member profile: ${err}` },
      500,
    );
  }
});

// ============== ACCESS PROFILES (org-scoped) ==============

app.get("/make-server-bd920daa/profiles", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    const data = await kv.get(orgProfilesKey(orgId));
    const profiles = data ? JSON.parse(data as string) : [];
    return c.json({ profiles });
  } catch (err) {
    console.log("Error fetching access profiles:", err);
    return c.json(
      { error: `Error fetching access profiles: ${err}` },
      500,
    );
  }
});

app.post("/make-server-bd920daa/profiles", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    const { profiles } = await c.req.json();
    await kv.set(
      orgProfilesKey(orgId),
      JSON.stringify(profiles),
    );
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving access profiles:", err);
    return c.json(
      { error: `Error saving access profiles: ${err}` },
      500,
    );
  }
});

// ============== THEME PREFERENCES (per-user) ==============

app.get("/make-server-bd920daa/theme", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const data = await kv.get(userThemeKey(user.id));
    if (data) {
      return c.json(JSON.parse(data as string));
    }
    return c.json({ mode: "dark", accent: "#FF0074" });
  } catch (err) {
    console.log("Error fetching theme:", err);
    return c.json({ mode: "dark", accent: "#FF0074" });
  }
});

app.post("/make-server-bd920daa/theme", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const { mode, accent } = await c.req.json();
    await kv.set(
      userThemeKey(user.id),
      JSON.stringify({ mode, accent }),
    );
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving theme:", err);
    return c.json({ error: `Error saving theme: ${err}` }, 500);
  }
});

// ============== MAGIC LINK AUTH ==============
app.post("/make-server-bd920daa/auth/magic-link", async (c) => {
  try {
    // Rate limiting
    const rlKey = getRateLimitKey(c, "auth");
    const rl = checkRateLimit(rlKey, RATE_LIMIT_MAX_AUTH);
    if (!rl.allowed) {
      console.log(
        `Rate limit exceeded for auth from key ${rlKey}`,
      );
      return c.json(
        {
          error: `Muitas tentativas. Tente novamente em ${rl.retryAfter}s.`,
        },
        429,
      );
    }

    const { email } = await c.req.json();
    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    // Sanitize email input
    const cleanEmail = sanitizeEmail(email);
    if (!cleanEmail) {
      return c.json(
        { error: "Formato de e-mail invalido." },
        400,
      );
    }

    console.log(
      `[AUTH] Received email: "${email}" | Clean: "${cleanEmail}" | ADMIN_EMAIL: "${ADMIN_EMAIL}" | Match: ${cleanEmail === ADMIN_EMAIL}`,
    );

    const supabase = getAdminClient();
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );

    // ============ Admin flow: ensure user exists, then send OTP email ============
    if (cleanEmail === ADMIN_EMAIL) {
      console.log(
        `[ADMIN AUTH] Processing magic link for ADMIN_EMAIL: ${ADMIN_EMAIL}`,
      );

      const {
        data: { users },
        error: listErr,
      } = await supabase.auth.admin.listUsers();
      if (listErr) {
        console.log(
          "[ADMIN AUTH] Error listing users:",
          listErr,
        );
        return c.json(
          {
            error: `Erro ao verificar usuários: ${listErr.message}`,
          },
          500,
        );
      }

      let adminUser = users?.find(
        (u: any) => u.email?.toLowerCase() === ADMIN_EMAIL,
      );
      console.log(
        `[ADMIN AUTH] Admin user exists: ${!!adminUser}`,
      );

      if (!adminUser) {
        console.log(
          `[ADMIN AUTH] Creating new admin user: ${ADMIN_EMAIL}`,
        );
        const { data: newAdmin, error: createError } =
          await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            user_metadata: { name: "Davidson Brandao" },
            email_confirm: true,
          });
        if (createError) {
          console.log(
            "[ADMIN AUTH] Error creating admin:",
            createError,
          );
          // If user already exists with different email case, try to find and update
          if (
            createError.message?.includes("already") ||
            createError.message?.includes("exists")
          ) {
            console.log(
              "[ADMIN AUTH] User might exist, trying to find by email...",
            );
            const existingUser = users?.find(
              (u: any) =>
                u.email?.toLowerCase() ===
                ADMIN_EMAIL.toLowerCase(),
            );
            if (existingUser) {
              console.log(
                "[ADMIN AUTH] Found existing user, updating...",
              );
              adminUser = existingUser;
            } else {
              return c.json(
                {
                  error: `Erro ao criar admin: ${createError.message}`,
                },
                500,
              );
            }
          } else {
            return c.json(
              {
                error: `Erro ao criar admin: ${createError.message}`,
              },
              500,
            );
          }
        } else {
          console.log(
            "[ADMIN AUTH] Admin user created successfully",
          );
          adminUser = newAdmin.user;
        }
      }

      if (adminUser) {
        console.log(
          "[ADMIN AUTH] Updating admin password to ensure it's current",
        );
        const { error: updateError } =
          await supabase.auth.admin.updateUserById(
            adminUser.id,
            {
              password: ADMIN_PASSWORD,
              email_confirm: true,
            },
          );
        if (updateError) {
          console.log(
            "[ADMIN AUTH] Error updating admin password:",
            updateError,
          );
        }
      }

      // Ensure admin is in org team_members
      const adminOrgId = adminUser.id;
      const membersData = await kv.get(orgTeamKey(adminOrgId));
      const members = membersData
        ? JSON.parse(membersData as string)
        : [];
      const adminExists = members.some(
        (m: any) =>
          m.role === "admin" &&
          m.email?.toLowerCase() === ADMIN_EMAIL,
      );
      if (!adminExists) {
        members.push({
          id: adminUser.id,
          name: "Davidson Brandao",
          email: ADMIN_EMAIL,
          phone: "",
          role: "admin",
          status: "active",
          createdAt: new Date().toISOString(),
        });
        await kv.set(
          orgTeamKey(adminOrgId),
          JSON.stringify(members),
        );

        // Also migrate legacy team if exists
        const legacyTeam = await kv.get(
          legacyTeamKey(adminUser.id),
        );
        if (legacyTeam) {
          const legacyMembers = JSON.parse(
            legacyTeam as string,
          );
          // Merge, avoiding duplicates
          for (const lm of legacyMembers) {
            if (
              !members.some(
                (m: any) =>
                  m.id === lm.id ||
                  m.email?.toLowerCase() ===
                    lm.email?.toLowerCase(),
              )
            ) {
              members.push(lm);
              // Map legacy team members to this org
              if (lm.id && lm.id !== adminUser.id) {
                await kv.set(`user_org_${lm.id}`, adminOrgId);
              }
            }
          }
          await kv.set(
            orgTeamKey(adminOrgId),
            JSON.stringify(members),
          );
        }
      }

      // Send OTP email via Supabase configured SMTP
      console.log(
        "[ADMIN AUTH] Sending OTP email to admin via SMTP",
      );
      const { error: otpError } =
        await anonClient.auth.signInWithOtp({
  email: ADMIN_EMAIL,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: "https://app.snyper.com.br/auth/confirm",
  },
});

      if (otpError) {
        console.log(
          "[ADMIN AUTH] SMTP OTP failed, falling back to password session:",
          otpError.message,
        );
        // Fallback: return session directly so admin is not locked out
        const { data: signInData, error: signInError } =
          await anonClient.auth.signInWithPassword({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
          });
        if (signInError || !signInData.session) {
          return c.json(
            {
              error: `Erro ao autenticar admin: ${signInError?.message || "sem sessao"}`,
            },
            500,
          );
        }
        console.log(
          "[ADMIN AUTH] Fallback: returning session directly",
        );
        return c.json({
          access_token: signInData.session.access_token,
          refresh_token: signInData.session.refresh_token,
        });
      }

      console.log(
        "[ADMIN AUTH] OTP email sent successfully to admin",
      );
      return c.json({ sent: true });
    }

    // ============ Regular user magic link flow ============
    const {
      data: { users: allUsers },
      error: listError,
    } = await supabase.auth.admin.listUsers();
    if (listError) {
      console.log(
        "Error listing users for magic link:",
        listError,
      );
      return c.json(
        { error: `Error checking user: ${listError.message}` },
        500,
      );
    }

    const userExists = allUsers?.some(
      (u: any) => u.email?.toLowerCase() === cleanEmail,
    );

    if (!userExists) {
      console.log(
        `Magic link attempt for non-existent user: ${cleanEmail}`,
      );
      return c.json(
        { error: "Signups not allowed: user not found" },
        403,
      );
    }

    // Send OTP email via Supabase configured SMTP
    const { error: otpError } =
      await anonClient.auth.signInWithOtp({
  email: cleanEmail,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: "https://app.snyper.com.br/auth/confirm",
  },
});

    if (otpError) {
      console.log("Error sending OTP email:", otpError.message);
      return c.json(
        {
          error: `Erro ao enviar magic link: ${otpError.message}`,
        },
        500,
      );
    }

    console.log(
      `[AUTH] OTP email sent successfully to: ${cleanEmail}`,
    );
    return c.json({ sent: true });
  } catch (err) {
    console.log("Error in magic link generation:", err);
    return c.json(
      { error: `Error in magic link generation: ${err}` },
      500,
    );
  }
});

// ============== SUPER ADMIN (SaaS Management) ==============

// Helper: check if user is the super admin
async function isSuperAdmin(user: any): Promise<boolean> {
  return user?.email?.toLowerCase() === ADMIN_EMAIL;
}

// KV keys for SaaS management
function tenantKey(orgId: string) {
  return `saas_tenant_${orgId}`;
}
function allTenantsKey() {
  return `saas_all_tenants`;
}
function couponKey(code: string) {
  return `saas_coupon_${code}`;
}
function allCouponsKey() {
  return `saas_all_coupons`;
}
function ticketKey(id: string) {
  return `saas_ticket_${id}`;
}
function allTicketsKey() {
  return `saas_all_tickets`;
}
function tenantTicketsKey(orgId: string) {
  return `saas_tenant_tickets_${orgId}`;
}
function allPlansKey() {
  return `saas_all_plans`;
}

// -- GET all tenants (super admin only)
app.get("/make-server-bd920daa/admin/tenants", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);

  try {
    const data = await kv.get(allTenantsKey());
    const tenants = data ? JSON.parse(data as string) : [];
    return c.json({ tenants });
  } catch (err) {
    console.log("Error fetching tenants:", err);
    return c.json(
      { error: `Error fetching tenants: ${err}` },
      500,
    );
  }
});

// -- CREATE tenant (invite a new company)
app.post("/make-server-bd920daa/admin/tenants", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);

  try {
    const body = await c.req.json();
    const {
      companyName,
      cnpj,
      ownerName,
      ownerEmail,
      ownerPhone,
      planId,
      trialDays,
      couponCode,
      notes,
    } = body;

    if (!companyName || !ownerName || !ownerEmail) {
      return c.json(
        {
          error:
            "companyName, ownerName, ownerEmail are required",
        },
        400,
      );
    }

    const now = new Date();
    const pendingId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const tenant = {
      id: pendingId,
      companyName,
      cnpj: cnpj || "",
      ownerName,
      ownerEmail,
      ownerPhone: ownerPhone || "",
      planId: planId || "",
      plan: "basic",
      status: "pending",
      trialDays: trialDays || 0,
      trialEnd: null,
      createdAt: now.toISOString(),
      activeUsers: 0,
      maxUsers: 5,
      discount: 0,
      couponCode: couponCode || null,
      extraDays: 0,
      notes: notes || "",
      storageUsageMB: 0,
      lastActiveAt: null,
      sentAt: null,
    };

    await kv.set(tenantKey(pendingId), JSON.stringify(tenant));

    const allData = await kv.get(allTenantsKey());
    const allTenants = allData
      ? JSON.parse(allData as string)
      : [];
    allTenants.push({
      id: pendingId,
      companyName,
      ownerEmail,
      createdAt: now.toISOString(),
    });
    await kv.set(allTenantsKey(), JSON.stringify(allTenants));

    return c.json({ tenant });
  } catch (err) {
    console.log("Error creating tenant:", err);
    return c.json(
      { error: `Error creating tenant: ${err}` },
      500,
    );
  }
});

// -- UPDATE tenant (change plan, status, add days, notes)
app.put(
  "/make-server-bd920daa/admin/tenants/:id",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user || !(await isSuperAdmin(user)))
      return c.json({ error: "Forbidden" }, 403);

    const tenantId = c.req.param("id");

    try {
      const updates = await c.req.json();
      const data = await kv.get(tenantKey(tenantId));
      if (!data)
        return c.json({ error: "Tenant not found" }, 404);

      const tenant = JSON.parse(data as string);
      const updated = { ...tenant, ...updates, id: tenantId };

      // Handle extra days (extend trial)
      if (
        updates.addDays &&
        typeof updates.addDays === "number"
      ) {
        const currentEnd = tenant.trialEnd
          ? new Date(tenant.trialEnd)
          : new Date();
        currentEnd.setDate(
          currentEnd.getDate() + updates.addDays,
        );
        updated.trialEnd = currentEnd.toISOString();
        updated.extraDays =
          (tenant.extraDays || 0) + updates.addDays;
        if (updated.status === "expired")
          updated.status = "trial";
        delete updated.addDays;
      }

      await kv.set(
        tenantKey(tenantId),
        JSON.stringify(updated),
      );
      return c.json({ tenant: updated });
    } catch (err) {
      console.log("Error updating tenant:", err);
      return c.json(
        { error: `Error updating tenant: ${err}` },
        500,
      );
    }
  },
);

// -- DELETE tenant
app.delete(
  "/make-server-bd920daa/admin/tenants/:id",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user || !(await isSuperAdmin(user)))
      return c.json({ error: "Forbidden" }, 403);

    const tenantId = c.req.param("id");

    try {
      // Remove tenant data
      await kv.del(tenantKey(tenantId));

      // Remove from all tenants list
      const allData = await kv.get(allTenantsKey());
      const allTenants = allData
        ? JSON.parse(allData as string)
        : [];
      const filtered = allTenants.filter(
        (t: any) => t.id !== tenantId,
      );
      await kv.set(allTenantsKey(), JSON.stringify(filtered));

      return c.json({ success: true });
    } catch (err) {
      console.log("Error deleting tenant:", err);
      return c.json(
        { error: `Error deleting tenant: ${err}` },
        500,
      );
    }
  },
);

// -- GET tenant detail
app.get(
  "/make-server-bd920daa/admin/tenants/:id",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user || !(await isSuperAdmin(user)))
      return c.json({ error: "Forbidden" }, 403);

    const tenantId = c.req.param("id");

    try {
      const data = await kv.get(tenantKey(tenantId));
      if (!data)
        return c.json({ error: "Tenant not found" }, 404);

      const tenant = JSON.parse(data as string);

      // Get team members count
      const teamData = await kv.get(orgTeamKey(tenantId));
      const members = teamData
        ? JSON.parse(teamData as string)
        : [];
      tenant.activeUsers = members.filter(
        (m: any) => m.status !== "removed",
      ).length;

      return c.json({ tenant, members });
    } catch (err) {
      console.log("Error fetching tenant detail:", err);
      return c.json(
        { error: `Error fetching tenant detail: ${err}` },
        500,
      );
    }
  },
);

// -- COUPONS
app.get("/make-server-bd920daa/admin/coupons", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);

  try {
    const data = await kv.get(allCouponsKey());
    return c.json({
      coupons: data ? JSON.parse(data as string) : [],
    });
  } catch (err) {
    console.log("Error fetching coupons:", err);
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

app.post("/make-server-bd920daa/admin/coupons", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);

  try {
    const {
      code,
      discountPercent,
      expiresAt,
      maxUses,
      description,
    } = await c.req.json();
    if (!code || !discountPercent)
      return c.json(
        { error: "code and discountPercent required" },
        400,
      );

    const coupon = {
      code: code.toUpperCase(),
      discountPercent,
      expiresAt: expiresAt || null,
      maxUses: maxUses || null,
      usedCount: 0,
      active: true,
      description: description || "",
      createdAt: new Date().toISOString(),
    };

    await kv.set(
      couponKey(coupon.code),
      JSON.stringify(coupon),
    );

    const allData = await kv.get(allCouponsKey());
    const all = allData ? JSON.parse(allData as string) : [];
    all.push(coupon);
    await kv.set(allCouponsKey(), JSON.stringify(all));

    return c.json({ coupon });
  } catch (err) {
    console.log("Error creating coupon:", err);
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

app.delete(
  "/make-server-bd920daa/admin/coupons/:code",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user || !(await isSuperAdmin(user)))
      return c.json({ error: "Forbidden" }, 403);

    const code = c.req.param("code").toUpperCase();

    try {
      await kv.del(couponKey(code));

      const allData = await kv.get(allCouponsKey());
      const all = allData ? JSON.parse(allData as string) : [];
      const filtered = all.filter(
        (cp: any) => cp.code !== code,
      );
      await kv.set(allCouponsKey(), JSON.stringify(filtered));

      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: `Error: ${err}` }, 500);
    }
  },
);

// -- SUPPORT TICKETS
app.get("/make-server-bd920daa/admin/tickets", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);

  try {
    const data = await kv.get(allTicketsKey());
    return c.json({
      tickets: data ? JSON.parse(data as string) : [],
    });
  } catch (err) {
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

app.put(
  "/make-server-bd920daa/admin/tickets/:id",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user || !(await isSuperAdmin(user)))
      return c.json({ error: "Forbidden" }, 403);

    const ticketId = c.req.param("id");

    try {
      const updates = await c.req.json();
      const data = await kv.get(allTicketsKey());
      const tickets = data ? JSON.parse(data as string) : [];
      const idx = tickets.findIndex(
        (t: any) => t.id === ticketId,
      );
      if (idx === -1)
        return c.json({ error: "Ticket not found" }, 404);

      tickets[idx] = { ...tickets[idx], ...updates };
      await kv.set(allTicketsKey(), JSON.stringify(tickets));

      return c.json({ ticket: tickets[idx] });
    } catch (err) {
      return c.json({ error: `Error: ${err}` }, 500);
    }
  },
);

// -- Client-facing ticket creation (any authenticated user can open a ticket)
app.post("/make-server-bd920daa/tickets", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const { subject, message, priority } = await c.req.json();
    if (!subject || !message)
      return c.json(
        { error: "subject and message required" },
        400,
      );

    const orgId = await resolveOrgId(user.id);

    const ticket = {
      id: `tkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      orgId,
      userId: user.id,
      userEmail: user.email,
      userName: user.user_metadata?.name || user.email,
      subject,
      message,
      priority: priority || "medium",
      status: "open",
      createdAt: new Date().toISOString(),
      responses: [],
    };

    // Add to all tickets
    const data = await kv.get(allTicketsKey());
    const tickets = data ? JSON.parse(data as string) : [];
    tickets.unshift(ticket);
    await kv.set(allTicketsKey(), JSON.stringify(tickets));

    return c.json({ ticket });
  } catch (err) {
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

// -- Admin stats overview
app.get("/make-server-bd920daa/admin/stats", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);

  try {
    const allData = await kv.get(allTenantsKey());
    const allTenants = allData
      ? JSON.parse(allData as string)
      : [];

    // Fetch full tenant data for each
    const tenantDetails = [];
    for (const t of allTenants) {
      const td = await kv.get(tenantKey(t.id));
      if (td) tenantDetails.push(JSON.parse(td as string));
    }

    const ticketsData = await kv.get(allTicketsKey());
    const tickets = ticketsData
      ? JSON.parse(ticketsData as string)
      : [];

    const stats = {
      totalTenants: tenantDetails.length,
      activeTenants: tenantDetails.filter(
        (t: any) => t.status === "active",
      ).length,
      trialTenants: tenantDetails.filter(
        (t: any) => t.status === "trial",
      ).length,
      pausedTenants: tenantDetails.filter(
        (t: any) => t.status === "paused",
      ).length,
      expiredTenants: tenantDetails.filter(
        (t: any) => t.status === "expired",
      ).length,
      basicPlan: tenantDetails.filter(
        (t: any) => t.plan === "basic",
      ).length,
      premiumPlan: tenantDetails.filter(
        (t: any) => t.plan === "premium",
      ).length,
      totalUsers: tenantDetails.reduce(
        (s: number, t: any) => s + (t.activeUsers || 1),
        0,
      ),
      openTickets: tickets.filter(
        (t: any) => t.status === "open",
      ).length,
      totalTickets: tickets.length,
      // Revenue estimation
      monthlyRevenue: tenantDetails
        .filter((t: any) => t.status === "active")
        .reduce((s: number, t: any) => {
          const base = t.plan === "premium" ? 197 : 97;
          const disc = t.discount || 0;
          return s + base * (1 - disc / 100);
        }, 0),
    };

    return c.json({ stats, tenants: tenantDetails, tickets });
  } catch (err) {
    console.log("Error fetching admin stats:", err);
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

// -- Admin: update tenant user (change email, etc.)
app.put(
  "/make-server-bd920daa/admin/tenants/:tenantId/users/:userId",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user || !(await isSuperAdmin(user)))
      return c.json({ error: "Forbidden" }, 403);

    const tenantId = c.req.param("tenantId");
    const userId = c.req.param("userId");

    try {
      const { email, name, status } = await c.req.json();
      const supabase = getAdminClient();

      const updateData: any = {};
      if (email) updateData.email = email;
      if (name) updateData.user_metadata = { name };

      if (Object.keys(updateData).length > 0) {
        const { error: updateErr } =
          await supabase.auth.admin.updateUserById(
            userId,
            updateData,
          );
        if (updateErr)
          return c.json(
            {
              error: `Erro ao atualizar usuario: ${updateErr.message}`,
            },
            400,
          );
      }

      // Update in team members
      if (status || name || email) {
        const teamData = await kv.get(orgTeamKey(tenantId));
        const members = teamData
          ? JSON.parse(teamData as string)
          : [];
        const idx = members.findIndex(
          (m: any) => m.id === userId,
        );
        if (idx >= 0) {
          if (name) members[idx].name = name;
          if (email) members[idx].email = email;
          if (status) members[idx].status = status;
          await kv.set(
            orgTeamKey(tenantId),
            JSON.stringify(members),
          );
        }
      }

      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: `Error: ${err}` }, 500);
    }
  },
);

// ============== INVOICES (NF-e) ==============

// -- PLANS CRUD (super admin)
app.get("/make-server-bd920daa/admin/plans", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);
  try {
    const data = await kv.get(allPlansKey());
    return c.json({
      plans: data ? JSON.parse(data as string) : [],
    });
  } catch (err) {
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

app.post("/make-server-bd920daa/admin/plans", async (c) => {
  const user = await getAuthUser(c);
  if (!user || !(await isSuperAdmin(user)))
    return c.json({ error: "Forbidden" }, 403);
  try {
    const { plans } = await c.req.json();
    await kv.set(allPlansKey(), JSON.stringify(plans));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

// -- SEND LICENSE (create auth user for a pending tenant)
app.post(
  "/make-server-bd920daa/admin/tenants/:id/send-license",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user || !(await isSuperAdmin(user)))
      return c.json({ error: "Forbidden" }, 403);

    const tenantId = c.req.param("id");

    try {
      const data = await kv.get(tenantKey(tenantId));
      if (!data)
        return c.json({ error: "Tenant not found" }, 404);
      const tenant = JSON.parse(data as string);

      if (tenant.status !== "pending") {
        return c.json(
          { error: "Licenca ja enviada para esta empresa" },
          400,
        );
      }

      const supabase = getAdminClient();
      const { data: newUser, error: createErr } =
        await supabase.auth.admin.createUser({
          email: tenant.ownerEmail,
          user_metadata: {
            name: tenant.ownerName,
            companyName: tenant.companyName,
          },
          email_confirm: true,
        });

      if (createErr) {
        return c.json(
          {
            error: `Erro ao criar usuario: ${createErr.message}`,
          },
          400,
        );
      }

      const realTenantId = newUser.user.id;

      // Update tenant with real ID and status
      const trialDays = tenant.trialDays || 0;
      const now = new Date();
      const trialEnd =
        trialDays > 0
          ? new Date(
              now.getTime() + trialDays * 24 * 60 * 60 * 1000,
            ).toISOString()
          : null;

      // Apply coupon discount
      let discount = 0;
      if (tenant.couponCode) {
        const couponData = await kv.get(
          couponKey(tenant.couponCode.toUpperCase()),
        );
        if (couponData) {
          const coupon = JSON.parse(couponData as string);
          if (
            coupon.active &&
            (!coupon.expiresAt ||
              coupon.expiresAt > now.toISOString())
          ) {
            discount = coupon.discountPercent || 0;
            coupon.usedCount = (coupon.usedCount || 0) + 1;
            await kv.set(
              couponKey(tenant.couponCode.toUpperCase()),
              JSON.stringify(coupon),
            );
          }
        }
      }

      const updatedTenant = {
        ...tenant,
        id: realTenantId,
        status: trialDays > 0 ? "trial" : "active",
        trialEnd,
        discount,
        sentAt: now.toISOString(),
        activeUsers: 1,
      };

      // Remove old pending key if different
      if (tenantId !== realTenantId) {
        await kv.del(tenantKey(tenantId));
      }
      await kv.set(
        tenantKey(realTenantId),
        JSON.stringify(updatedTenant),
      );

      // Update all tenants list
      const allData = await kv.get(allTenantsKey());
      const allTenants = allData
        ? JSON.parse(allData as string)
        : [];
      const idx = allTenants.findIndex(
        (t: any) => t.id === tenantId,
      );
      if (idx >= 0) {
        allTenants[idx] = {
          ...allTenants[idx],
          id: realTenantId,
        };
      }
      await kv.set(allTenantsKey(), JSON.stringify(allTenants));

      // Map user to org
      await kv.set(`user_org_${realTenantId}`, realTenantId);

      // Create tenant team
      await kv.set(
        orgTeamKey(realTenantId),
        JSON.stringify([
          {
            id: realTenantId,
            name: tenant.ownerName,
            email: tenant.ownerEmail,
            phone: tenant.ownerPhone || "",
            role: "admin",
            status: "active",
            createdAt: now.toISOString(),
          },
        ]),
      );

      // Send magic link email via Supabase SMTP so the user can access the system
      try {
        const anonClient = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_ANON_KEY")!,
        );
        const { error: otpError } =
          await anonClient.auth.signInWithOtp({
  email: tenant.ownerEmail,
  options: {
    shouldCreateUser: false,
    emailRedirectTo: "https://app.snyper.com.br/auth/confirm",
  },
});
        if (otpError) {
          console.log(
            `[SEND-LICENSE] Warning: could not send OTP email to ${tenant.ownerEmail}:`,
            otpError.message,
          );
        } else {
          console.log(
            `[SEND-LICENSE] Magic link email sent to ${tenant.ownerEmail}`,
          );
        }
      } catch (emailErr) {
        console.log(
          "[SEND-LICENSE] Error sending email:",
          emailErr,
        );
      }

      return c.json({ tenant: updatedTenant });
    } catch (err) {
      console.log("Error sending license:", err);
      return c.json({ error: `Error: ${err}` }, 500);
    }
  },
);

// ============== INVOICES (NF-e) ==============

app.get("/make-server-bd920daa/invoices", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    const data = await kv.get(orgInvoicesKey(orgId));
    return c.json({
      invoices: data ? JSON.parse(data as string) : [],
    });
  } catch (err) {
    console.log("Error fetching invoices:", err);
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

app.post("/make-server-bd920daa/invoices", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    const { invoices } = await c.req.json();
    await kv.set(
      orgInvoicesKey(orgId),
      JSON.stringify(invoices),
    );
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving invoices:", err);
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

app.get("/make-server-bd920daa/invoices/config", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    const data = await kv.get(orgInvoiceConfigKey(orgId));
    return c.json({
      config: data ? JSON.parse(data as string) : null,
    });
  } catch (err) {
    console.log("Error fetching invoice config:", err);
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

app.post("/make-server-bd920daa/invoices/config", async (c) => {
  const user = await getAuthUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const orgId = await resolveOrgId(user.id);
    const { config } = await c.req.json();
    await kv.set(
      orgInvoiceConfigKey(orgId),
      JSON.stringify(config),
    );
    return c.json({ success: true });
  } catch (err) {
    console.log("Error saving invoice config:", err);
    return c.json({ error: `Error: ${err}` }, 500);
  }
});

// ============== FILE UPLOAD (Deliverables) ==============

app.post(
  "/make-server-bd920daa/upload/deliverable",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const orgId = await resolveOrgId(user.id);
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return c.json({ error: "Nenhum arquivo enviado" }, 400);
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        return c.json(
          {
            error: `Arquivo excede o limite de 10MB (${(file.size / 1024 / 1024).toFixed(1)}MB)`,
          },
          400,
        );
      }

      // Validate MIME type
      if (!ALLOWED_MIMES.includes(file.type)) {
        return c.json(
          {
            error: `Tipo de arquivo nao permitido: ${file.type}. Aceitos: imagens (JPG, PNG, GIF, WebP) e PDF.`,
          },
          400,
        );
      }

      const ext = file.name.split(".").pop() || "bin";
      const timestamp = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const storagePath = `${orgId}/${timestamp}_${rand}.${ext}`;

      const supabase = getAdminClient();

      // Upload file to Supabase Storage
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from(DELIVERABLE_BUCKET)
        .upload(storagePath, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.log("Upload error:", uploadError);
        return c.json(
          {
            error: `Erro ao fazer upload: ${uploadError.message}`,
          },
          500,
        );
      }

      // Generate signed URL (valid for 7 days)
      const { data: signedData, error: signError } =
        await supabase.storage
          .from(DELIVERABLE_BUCKET)
          .createSignedUrl(storagePath, 60 * 60 * 24 * 7); // 7 days

      if (signError) {
        console.log("Signed URL error:", signError);
        return c.json(
          { error: `Erro ao gerar URL: ${signError.message}` },
          500,
        );
      }

      return c.json({
        url: signedData.signedUrl,
        storagePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
      });
    } catch (err) {
      console.log("Error uploading deliverable file:", err);
      return c.json({ error: `Erro no upload: ${err}` }, 500);
    }
  },
);

// Refresh signed URL for a deliverable file
app.post(
  "/make-server-bd920daa/upload/refresh-url",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const orgId = await resolveOrgId(user.id);
      const { storagePath } = await c.req.json();
      if (!storagePath)
        return c.json({ error: "storagePath required" }, 400);

      // SECURITY: Verify the file belongs to this org
      if (!storagePath.startsWith(`${orgId}/`)) {
        console.log(
          `Security: user ${user.id} tried to refresh URL for path ${storagePath} not in org ${orgId}`,
        );
        return c.json(
          { error: "Acesso negado a este arquivo" },
          403,
        );
      }

      const supabase = getAdminClient();
      const { data, error } = await supabase.storage
        .from(DELIVERABLE_BUCKET)
        .createSignedUrl(storagePath, 60 * 60 * 24 * 7);

      if (error)
        return c.json(
          { error: `Erro ao renovar URL: ${error.message}` },
          500,
        );
      return c.json({ url: data.signedUrl });
    } catch (err) {
      return c.json({ error: `Erro: ${err}` }, 500);
    }
  },
);

// Delete a deliverable file
app.delete(
  "/make-server-bd920daa/upload/deliverable",
  async (c) => {
    const user = await getAuthUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    try {
      const orgId = await resolveOrgId(user.id);
      const { storagePath } = await c.req.json();
      if (!storagePath)
        return c.json({ error: "storagePath required" }, 400);

      // SECURITY: Verify the file belongs to this org
      if (!storagePath.startsWith(`${orgId}/`)) {
        console.log(
          `Security: user ${user.id} tried to delete file ${storagePath} not in org ${orgId}`,
        );
        return c.json(
          { error: "Acesso negado a este arquivo" },
          403,
        );
      }

      const supabase = getAdminClient();
      const { error } = await supabase.storage
        .from(DELIVERABLE_BUCKET)
        .remove([storagePath]);

      if (error)
        return c.json(
          {
            error: `Erro ao excluir arquivo: ${error.message}`,
          },
          500,
        );
      return c.json({ success: true });
    } catch (err) {
      return c.json({ error: `Erro: ${err}` }, 500);
    }
  },
);

Deno.serve(app.fetch);