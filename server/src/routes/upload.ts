import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { env } from "../config/env.js";
import { getAuthUser } from "../lib/auth.js";
import { resolveOrgId } from "../lib/tenant.js";
import {
  createInviteToken,
  deleteUploadRecord,
  getUploadFilePath,
  getUploadRecord,
  hashInviteToken,
  saveUpload,
} from "../lib/state.js";

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

function createPublicFileUrl(storagePath: string, token: string) {
  return `${env.API_URL}/upload/file?path=${encodeURIComponent(storagePath)}&token=${encodeURIComponent(token)}`;
}

function getContentType(fileName: string, mimeType: string) {
  if (mimeType) return mimeType;
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  return "application/octet-stream";
}

function isValidToken(token: unknown): token is string {
  return typeof token === "string" && token.trim().length > 0;
}

export const uploadRoute = new Hono();

uploadRoute.get("/file", async (c) => {
  try {
    const storagePath = c.req.query("path");
    const token = c.req.query("token");

    if (!isValidStoragePath(storagePath) || !isValidToken(token)) {
      return c.json({ error: "Arquivo ou token invalidos" }, 400);
    }

    const record = await getUploadRecord(storagePath);
    if (!record) {
      return c.json({ error: "Arquivo nao encontrado" }, 404);
    }

    if (record.tokenExpiresAt && new Date(record.tokenExpiresAt).getTime() <= Date.now()) {
      return c.json({ error: "Token expirado" }, 403);
    }

    if (record.tokenHash !== hashInviteToken(token)) {
      return c.json({ error: "Token invalido" }, 403);
    }

    const filePath = getUploadFilePath(storagePath);
    const file = await readFile(filePath);

    return new Response(file, {
      headers: {
        "Content-Type": getContentType(record.fileName, record.mimeType),
        "Content-Length": String(file.byteLength),
        "Content-Disposition": `inline; filename="${record.fileName}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    console.error("Upload file route error:", error);
    return c.json({ error: "Falha ao abrir arquivo" }, 500);
  }
});

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
    const filePath = getUploadFilePath(storagePath);
    await mkdir(path.dirname(filePath), { recursive: true });

    const arrayBuffer = await fileEntry.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    const token = createInviteToken();
    const tokenExpiresAt = new Date(
      Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString();

    await saveUpload({
      orgId,
      storagePath,
      fileName: fileEntry.name,
      mimeType: fileEntry.type,
      fileSize: fileEntry.size,
      createdAt: new Date().toISOString(),
      tokenHash: hashInviteToken(token),
      tokenExpiresAt,
    });

    return c.json({
      url: createPublicFileUrl(storagePath, token),
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

    const record = await getUploadRecord(storagePath);
    if (!record) {
      return c.json({ error: "Arquivo nao encontrado" }, 404);
    }

    const token = createInviteToken();
    const tokenExpiresAt = new Date(
      Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    ).toISOString();

    await saveUpload({
      ...record,
      tokenHash: hashInviteToken(token),
      tokenExpiresAt,
    });

    return c.json({ url: createPublicFileUrl(storagePath, token) });
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

    const filePath = getUploadFilePath(storagePath);
    await rm(filePath, { force: true });
    await deleteUploadRecord(storagePath);

    return c.json({ success: true });
  } catch (error) {
    console.error("Delete deliverable error:", error);
    return c.json({ error: `Erro: ${error}` }, 500);
  }
});
