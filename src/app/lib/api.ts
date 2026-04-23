import { getStoredAccessToken } from "./session";

const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  (import.meta.env.DEV ? "http://localhost:3001" : window.location.origin);

type FunctionHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function tryParseJsonString(value: unknown) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function buildHeaders(init: RequestInit = {}) {
  if (init.headers instanceof Headers) {
    return Object.fromEntries(init.headers.entries());
  }

  if (Array.isArray(init.headers)) {
    return Object.fromEntries(init.headers);
  }

  return (init.headers as Record<string, string> | undefined) || {};
}

async function request(path: string, init: RequestInit = {}, isUpload = false) {
  const method = (init.method || "GET") as FunctionHttpMethod;
  const body =
    init.body === undefined
      ? undefined
      : init.body instanceof FormData
        ? init.body
        : tryParseJsonString(init.body);
  const headers = buildHeaders(init);
  const accessToken = getStoredAccessToken();

  const response = await fetch(`${apiBaseUrl}${normalizePath(path)}`, {
    ...init,
    method,
    headers: {
      ...(isUpload || body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}`, "X-User-Token": accessToken } : {}),
    },
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Erro ao chamar a API do backend");
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  return response.text();
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  return request(path, init, false);
}

export async function apiFetchUpload(
  path: string,
  formData: FormData,
  init: RequestInit = {},
) {
  return request(path, { ...init, method: init.method || "POST", body: formData }, true);
}

