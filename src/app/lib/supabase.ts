import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL?.trim() ||
  "https://your-project.supabase.co";

const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  "sb_publishable_your_public_key";

const functionBase =
  import.meta.env.VITE_SERVER_FUNCTION_BASE?.trim() ||
  "make-server";
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim() || "";
type FunctionHttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

function normalizePath(path: string) {
  return path.startsWith("/") ? path : `/${path}`;
}

function buildFunctionPath(path: string) {
  return `${functionBase}${normalizePath(path)}`;
}

function shouldUseCustomApi(path: string) {
  if (!apiBaseUrl) return false;

  return [
    "/health",
    "/org",
    "/finance",
    "/team",
    "/profiles",
    "/theme",
    "/invoices",
    "/tickets",
    "/admin",
    "/upload",
    "/auth/profile",
  ].some((candidate) => normalizePath(path) === candidate || normalizePath(path).startsWith(`${candidate}/`));
}

function tryParseJsonString(value: unknown) {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const method = (init.method || "GET") as FunctionHttpMethod;

  let body: any = undefined;

  if (init.body !== undefined) {
    if (init.body instanceof FormData) {
      body = init.body;
    } else {
      body = tryParseJsonString(init.body);
    }
  }

  const headers =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init.headers)
      ? Object.fromEntries(init.headers)
      : (init.headers as Record<string, string> | undefined);

  if (shouldUseCustomApi(path)) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const response = await fetch(`${apiBaseUrl}${normalizePath(path)}`, {
      ...init,
      method,
      headers: {
        ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(headers || {}),
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

    return response.json();
  }

  const { data, error } = await supabase.functions.invoke(
    buildFunctionPath(path),
    {
      method,
      body,
      headers,
    }
  );

  if (error) {
    throw new Error(error.message || "Erro ao chamar a função do servidor");
  }

  return data;
}

export async function apiFetchUpload(
  path: string,
  formData: FormData,
  init: RequestInit = {}
) {
  const method = (init.method || "POST") as FunctionHttpMethod;

  const headers =
    init.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : Array.isArray(init.headers)
      ? Object.fromEntries(init.headers)
      : (init.headers as Record<string, string> | undefined);

  if (shouldUseCustomApi(path)) {
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    const response = await fetch(`${apiBaseUrl}${normalizePath(path)}`, {
      ...init,
      method,
      headers: {
        ...(headers || {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}`, "X-User-Token": accessToken } : {}),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Erro ao enviar arquivo para a API do backend");
    }

    return response.json();
  }

  const { data, error } = await supabase.functions.invoke(
    buildFunctionPath(path),
    {
      method,
      body: formData,
      headers,
    }
  );

  if (error) {
    throw new Error(error.message || "Erro ao enviar arquivo para o servidor");
  }

  return data;
}
