export interface AppUser {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
  user_metadata?: Record<string, any>;
  role?: "superadmin" | "admin" | "member";
  orgId?: string;
  status?: "active" | "invited" | "disabled";
}

export interface AppSession {
  access_token: string;
  expires_at: string;
  user: AppUser;
}

const SESSION_KEY = "snyper.session";

export function getStoredSession(): AppSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSession;
  } catch {
    return null;
  }
}

export function setStoredSession(session: AppSession | null) {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignorar falhas de armazenamento local.
  }
}

export function getStoredAccessToken() {
  return getStoredSession()?.access_token || null;
}

export function clearStoredSession() {
  setStoredSession(null);
}
