export function normalizeStoredJson<T>(data: unknown, fallback: T): T {
  if (!data) return fallback;
  if (typeof data === "string") {
    try {
      return JSON.parse(data) as T;
    } catch {
      return fallback;
    }
  }
  return data as T;
}
