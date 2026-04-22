import { Hono } from "hono";
import { env } from "../config/env.js";
import { getAuthUser } from "../lib/auth.js";
import { getSupabaseAdminClient } from "../lib/supabase.js";
import { resolveOrgId } from "../lib/tenant.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7;
const ALLOWED_MIMES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];

function isValidStoragePath(storagePath: unknown): storagePath is string {
  return typeof storagePath === "string" && storagePath.trim().length > 0;
}

function ensureOrgAccess(orgId: string, storagePath: string) {
  return storagePath.startsWith(`${orgId}/`);
}

function buildStoragePath(orgId: string, fileName: string) {
  const extension = fileName.includes(".")
    ? fileName.split(".").pop()?.toLowerCase() || "bin"
    : "bin";
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `${orgId}/${timestamp}_${randomSuffix}.${extension}`;
}

export const uploadRoute = new Hono();

uploadRoute.post("/deliverable", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orgId = await resolveOrgId(user.id);
    const formData = await c.req.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      return c.json({ error: "Nenhum arquivo enviado" }, 400);
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return c.json(
        {
          error: `Arquivo excede o limite de 10MB (${(fileEntry.size / 1024 / 1024).toFixed(1)}MB)`,
        },
        400,
      );
    }

    if (!ALLOWED_MIMES.includes(fileEntry.type)) {
      return c.json(
        {
          error: `Tipo de arquivo nao permitido: ${fileEntry.type}. Aceitos: imagens (JPG, PNG, GIF, WebP) e PDF.`,
        },
        400,
      );
    }

    const storagePath = buildStoragePath(orgId, fileEntry.name);
    const supabase = getSupabaseAdminClient();
    const arrayBuffer = await fileEntry.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from(env.SUPABASE_DELIVERABLES_BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: fileEntry.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload deliverable error:", uploadError);
      return c.json(
        { error: `Erro ao fazer upload: ${uploadError.message}` },
        500,
      );
    }

    const { data: signedData, error: signError } = await supabase.storage
      .from(env.SUPABASE_DELIVERABLES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (signError) {
      console.error("Create signed URL error:", signError);
      return c.json(
        { error: `Erro ao gerar URL: ${signError.message}` },
        500,
      );
    }

    return c.json({
      url: signedData.signedUrl,
      storagePath,
      fileName: fileEntry.name,
      fileSize: fileEntry.size,
      mimeType: fileEntry.type,
    });
  } catch (error) {
    console.error("Upload deliverable route error:", error);
    return c.json({ error: `Erro no upload: ${error}` }, 500);
  }
});

uploadRoute.post("/refresh-url", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orgId = await resolveOrgId(user.id);
    const { storagePath } = await c.req.json();

    if (!isValidStoragePath(storagePath)) {
      return c.json({ error: "storagePath required" }, 400);
    }

    if (!ensureOrgAccess(orgId, storagePath)) {
      console.warn(
        `Security: user ${user.id} tried to refresh ${storagePath} outside org ${orgId}`,
      );
      return c.json({ error: "Acesso negado a este arquivo" }, 403);
    }

    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(env.SUPABASE_DELIVERABLES_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);

    if (error) {
      return c.json({ error: `Erro ao renovar URL: ${error.message}` }, 500);
    }

    return c.json({ url: data.signedUrl });
  } catch (error) {
    console.error("Refresh deliverable URL error:", error);
    return c.json({ error: `Erro: ${error}` }, 500);
  }
});

uploadRoute.delete("/deliverable", async (c) => {
  const user = await getAuthUser(c);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const orgId = await resolveOrgId(user.id);
    const { storagePath } = await c.req.json();

    if (!isValidStoragePath(storagePath)) {
      return c.json({ error: "storagePath required" }, 400);
    }

    if (!ensureOrgAccess(orgId, storagePath)) {
      console.warn(
        `Security: user ${user.id} tried to delete ${storagePath} outside org ${orgId}`,
      );
      return c.json({ error: "Acesso negado a este arquivo" }, 403);
    }

    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.storage
      .from(env.SUPABASE_DELIVERABLES_BUCKET)
      .remove([storagePath]);

    if (error) {
      return c.json(
        { error: `Erro ao excluir arquivo: ${error.message}` },
        500,
      );
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete deliverable error:", error);
    return c.json({ error: `Erro: ${error}` }, 500);
  }
});
