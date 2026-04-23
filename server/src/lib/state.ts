import crypto from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";

export interface StoredUser {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt?: string | null;
  role: "superadmin" | "admin" | "member";
  status: "active" | "invited" | "disabled";
  orgId: string;
  passwordHash?: string;
  passwordSalt?: string;
  inviteTokenHash?: string | null;
  inviteTokenExpiresAt?: string | null;
  userMetadata: Record<string, unknown>;
}

export interface StoredSession {
  tokenHash: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
}

export interface StoredUpload {
  orgId: string;
  storagePath: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
  tokenHash: string;
  tokenExpiresAt: string;
}

export interface AppState {
  version: 1;
  users: StoredUser[];
  sessions: StoredSession[];
  kv: Record<string, unknown>;
  uploads: Record<string, StoredUpload>;
}

const DEFAULT_ADMIN_EMAIL = "admin@snyper.local";
const DEFAULT_ADMIN_PASSWORD = "ChangeMe123!";
const DEFAULT_ADMIN_NAME = "Administrador";

const stateFilePath = path.resolve(env.DATA_DIR, "state.json");
const uploadRootPath = path.resolve(env.UPLOAD_DIR);

let cachedState: AppState | null = null;
let writeChain = Promise.resolve();

function emptyState(): AppState {
  return {
    version: 1,
    users: [],
    sessions: [],
    kv: {},
    uploads: {},
  };
}

async function ensureDirs() {
  await mkdir(path.dirname(stateFilePath), { recursive: true });
  await mkdir(uploadRootPath, { recursive: true });
}

async function readStateFile(): Promise<AppState> {
  await ensureDirs();

  try {
    const raw = await readFile(stateFilePath, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...emptyState(),
      ...parsed,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      kv: parsed.kv && typeof parsed.kv === "object" ? parsed.kv : {},
      uploads: parsed.uploads && typeof parsed.uploads === "object" ? parsed.uploads : {},
    };
  } catch (error: any) {
    if (error?.code !== "ENOENT") {
      console.error("Falha ao ler estado local, iniciando vazio:", error);
    }
    return emptyState();
  }
}

async function persistState(state: AppState) {
  await ensureDirs();
  const tempFile = `${stateFilePath}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
  await rename(tempFile, stateFilePath);
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function sanitizeText(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seedBootstrapAdmin(state: AppState): AppState {
  if (state.users.length > 0) {
    return state;
  }

  const bootstrapEmail = env.BOOTSTRAP_ADMIN_EMAIL || (env.NODE_ENV === "production" ? "" : DEFAULT_ADMIN_EMAIL);
  const bootstrapPassword =
    env.BOOTSTRAP_ADMIN_PASSWORD || (env.NODE_ENV === "production" ? "" : DEFAULT_ADMIN_PASSWORD);

  if (!bootstrapEmail || !bootstrapPassword) {
    const message =
      "As credenciais iniciais nao foram configuradas. Defina BOOTSTRAP_ADMIN_EMAIL e BOOTSTRAP_ADMIN_PASSWORD no VPS.";

    if (env.NODE_ENV === "production") {
      throw new Error(message);
    }

    console.warn(message);
    return state;
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = crypto
    .scryptSync(bootstrapPassword, salt, 64)
    .toString("hex");

  const now = new Date().toISOString();
  state.users.push({
    id: crypto.randomUUID(),
    email: bootstrapEmail.toLowerCase(),
    createdAt: now,
    lastSignInAt: null,
    role: "superadmin",
    status: "active",
    orgId: env.BOOTSTRAP_ORG_ID,
    passwordHash,
    passwordSalt: salt,
    inviteTokenHash: null,
    inviteTokenExpiresAt: null,
    userMetadata: {
      name: env.BOOTSTRAP_ADMIN_NAME || DEFAULT_ADMIN_NAME,
      role: "superadmin",
      orgId: env.BOOTSTRAP_ORG_ID,
    },
  });

  return state;
}

async function loadState() {
  if (!cachedState) {
    cachedState = seedBootstrapAdmin(await readStateFile());
    await persistState(cachedState);
  }

  return cachedState;
}

export async function readState() {
  return clone(await loadState());
}

export async function mutateState<T>(fn: (state: AppState) => Promise<T> | T) {
  let release: (() => void) | undefined;
  const lock = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = writeChain;
  writeChain = previous.then(() => lock);

  await previous;

  try {
    const state = await loadState();
    const result = await fn(state);
    cachedState = state;
    await persistState(state);
    return result;
  } finally {
    release?.();
  }
}

export async function getKvValue(key: string) {
  const state = await loadState();
  return state.kv[key];
}

export async function setKvValue(key: string, value: unknown) {
  return mutateState((state) => {
    state.kv[key] = value;
    return value;
  });
}

export async function deleteKvValue(key: string) {
  return mutateState((state) => {
    delete state.kv[key];
  });
}

export async function findUserById(userId: string) {
  const state = await loadState();
  return state.users.find((user) => user.id === userId) || null;
}

export async function findUserByEmail(email: string) {
  const normalized = sanitizeText(email).toLowerCase();
  if (!normalized) return null;

  const state = await loadState();
  return state.users.find((user) => user.email.toLowerCase() === normalized) || null;
}

export async function listUsers() {
  const state = await loadState();
  return state.users.map((user) => clone(user));
}

export async function upsertUser(user: StoredUser) {
  return mutateState((state) => {
    const index = state.users.findIndex((item) => item.id === user.id);
    if (index >= 0) {
      state.users[index] = user;
    } else {
      state.users.push(user);
    }
    return clone(user);
  });
}

export async function updateUserById(
  userId: string,
  updater: (user: StoredUser) => StoredUser,
) {
  return mutateState((state) => {
    const index = state.users.findIndex((user) => user.id === userId);
    if (index === -1) return null;
    const nextUser = updater(clone(state.users[index]));
    state.users[index] = nextUser;
    return clone(nextUser);
  });
}

export async function removeUser(userId: string) {
  return mutateState((state) => {
    state.users = state.users.filter((user) => user.id !== userId);
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
  });
}

export async function createSession(userId: string, ttlDays = env.SESSION_TTL_DAYS) {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const now = Date.now();
  const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();
  const createdAt = new Date(now).toISOString();

  await mutateState((state) => {
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
    state.sessions.push({
      tokenHash,
      userId,
      createdAt,
      expiresAt,
    });
  });

  return { token: rawToken, tokenHash, expiresAt, createdAt };
}

export async function findSessionByToken(token: string) {
  const tokenHash = hashToken(token);
  const state = await loadState();
  const session = state.sessions.find((item) => safeEqual(item.tokenHash, tokenHash));

  if (!session) return null;
  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    await revokeSession(token);
    return null;
  }

  return clone(session);
}

export async function revokeSession(token: string) {
  const tokenHash = hashToken(token);
  await mutateState((state) => {
    state.sessions = state.sessions.filter((session) => !safeEqual(session.tokenHash, tokenHash));
  });
}

export async function revokeSessionsForUser(userId: string) {
  await mutateState((state) => {
    state.sessions = state.sessions.filter((session) => session.userId !== userId);
  });
}

export async function findUserByInviteToken(token: string) {
  const inviteTokenHash = hashInviteToken(token);
  const state = await loadState();
  const user = state.users.find((item) => {
    if (!item.inviteTokenHash || !item.inviteTokenExpiresAt) return false;
    if (new Date(item.inviteTokenExpiresAt).getTime() <= Date.now()) return false;
    return safeEqual(item.inviteTokenHash, inviteTokenHash);
  });

  return user ? clone(user) : null;
}

export function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const passwordHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { passwordHash, salt };
}

export function verifyPassword(password: string, passwordHash: string, salt: string) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(hash, passwordHash);
}

export function createInviteToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string) {
  return hashToken(token);
}

export function getUploadRootPath() {
  return uploadRootPath;
}

export function getUploadFilePath(storagePath: string) {
  return path.resolve(uploadRootPath, storagePath);
}

export async function saveUpload(record: StoredUpload) {
  return mutateState((state) => {
    state.uploads[record.storagePath] = record;
    return clone(record);
  });
}

export async function getUploadRecord(storagePath: string) {
  const state = await loadState();
  const record = state.uploads[storagePath];
  return record ? clone(record) : null;
}

export async function deleteUploadRecord(storagePath: string) {
  return mutateState((state) => {
    delete state.uploads[storagePath];
  });
}

export async function listUploads() {
  const state = await loadState();
  return Object.values(state.uploads).map((upload) => clone(upload));
}
