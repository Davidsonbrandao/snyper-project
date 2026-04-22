import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "./auth-context";
import { apiFetch } from "./supabase";

// ========== Types ==========
interface ModulePermission {
  view: boolean;
  add: boolean;
  edit: boolean;
  delete: boolean;
}

interface AccessProfile {
  id: string;
  name: string;
  description: string;
  isDefault?: boolean;
  permissions: Record<string, ModulePermission>;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "member";
  status: "active" | "invited";
  createdAt: string;
  profileId?: string;
}

// ===== SUPER ADMIN FIX =====
const SUPER_ADMIN_EMAIL = "admin@snyper.com.br";

// Route-to-module mapping
const ROUTE_TO_MODULE: Record<string, string> = {
  "/": "dashboard",
  "/clientes": "clientes",
  "/pipeline": "pipeline",
  "/projetos": "projetos",
  "/lancamentos": "lancamentos",
  "/despesas": "despesas",
  "/contas": "contas",
  "/servicos": "servicos",
  "/marketing": "marketing",
  "/metas": "metas",
  "/equipe": "equipe",
  "/perfil": "dashboard",
  "/notas-fiscais": "notas_fiscais",
  "/relatorios": "dashboard",
};

const PROFILES_LOCAL_KEY = "@pilar:access_profiles";

/** Load profiles from localStorage (fallback / cache) */
function loadProfilesLocal(): AccessProfile[] {
  try {
    const raw = localStorage.getItem(PROFILES_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [];
}

/** Save profiles to localStorage (cache) */
function saveProfilesLocal(profiles: AccessProfile[]) {
  try {
    localStorage.setItem(PROFILES_LOCAL_KEY, JSON.stringify(profiles));
    window.dispatchEvent(new Event("profiles-updated"));
  } catch {}
}

// Full permission object (admin default)
const FULL_PERMISSION: ModulePermission = {
  view: true,
  add: true,
  edit: true,
  delete: true,
};

// ========== Context ==========
interface PermissionsContextType {
  can: (module: string, action: keyof ModulePermission) => boolean;
  canAny: (module: string, ...actions: (keyof ModulePermission)[]) => boolean;
  canAccessRoute: (route: string) => boolean;
  getModulePermissions: (module: string) => ModulePermission;
  userRole: "admin" | "member" | null;
  profileName: string;
  loaded: boolean;
  reloadProfiles: () => void;
  profiles: AccessProfile[];
  saveProfiles: (profiles: AccessProfile[]) => Promise<void>;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [profiles, setProfiles] = useState<AccessProfile[]>(loadProfilesLocal);
  const [loaded, setLoaded] = useState(false);

  const isSuperAdmin = useMemo(() => {
    return user?.email?.toLowerCase() === SUPER_ADMIN_EMAIL;
  }, [user?.email]);

  // Load team members and profiles from server
  useEffect(() => {
    if (!user || !session?.access_token) {
      setLoaded(true);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const [teamData, profilesData] = await Promise.all([
          apiFetch("/team"),
          apiFetch("/profiles"),
        ]);

        if (cancelled) return;

        setMembers(teamData.members || []);

        if (profilesData.profiles && profilesData.profiles.length > 0) {
          setProfiles(profilesData.profiles);
          saveProfilesLocal(profilesData.profiles);
        } else {
          const localProfiles = loadProfilesLocal();
          if (localProfiles.length > 0) {
            setProfiles(localProfiles);
            apiFetch("/profiles", {
              method: "POST",
              body: JSON.stringify({ profiles: localProfiles }),
            }).catch((err) =>
              console.error("Error migrating profiles to server:", err)
            );
          }
        }

        setLoaded(true);
      } catch (err) {
        console.error("Permissions: error loading data:", err);
        if (!cancelled) {
          const localProfiles = loadProfilesLocal();
          if (localProfiles.length > 0) setProfiles(localProfiles);
          setLoaded(true);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user, session?.access_token]);

  // Listen for profile updates from team-page (same-tab)
  useEffect(() => {
    const handler = () => {
      setProfiles(loadProfilesLocal());
    };

    window.addEventListener("storage", handler);
    window.addEventListener("profiles-updated", handler);

    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener("profiles-updated", handler);
    };
  }, []);

  const reloadProfiles = useCallback(() => {
    setProfiles(loadProfilesLocal());

    if (user && session?.access_token) {
      apiFetch("/profiles")
        .then((data) => {
          if (data.profiles) {
            setProfiles(data.profiles);
            saveProfilesLocal(data.profiles);
          }
        })
        .catch(() => {});
    }
  }, [user, session?.access_token]);

  const saveProfiles = useCallback(async (newProfiles: AccessProfile[]) => {
    setProfiles(newProfiles);
    saveProfilesLocal(newProfiles);

    try {
      await apiFetch("/profiles", {
        method: "POST",
        body: JSON.stringify({ profiles: newProfiles }),
      });
    } catch (err) {
      console.error("Error saving profiles to server:", err);
    }
  }, []);

  // Determine current user's member record
  const currentMember = useMemo(() => {
    if (!user) return null;

    return (
      members.find((m) => m.id === user.id) ||
      members.find((m) => m.email?.toLowerCase() === user.email?.toLowerCase()) ||
      null
    );
  }, [user, members]);

  // Determine role
  const userRole = useMemo((): "admin" | "member" | null => {
    if (!user) return null;

    if (isSuperAdmin) return "admin";
    if (!currentMember) return "admin";

    return currentMember.role;
  }, [user, currentMember, isSuperAdmin]);

  // Get the profile for the current user
  const currentProfile = useMemo((): AccessProfile | null => {
    if (userRole === "admin") return null;
    if (!currentMember?.profileId) return null;

    return profiles.find((p) => p.id === currentMember.profileId) || null;
  }, [userRole, currentMember, profiles]);

  const profileName = useMemo(() => {
    if (userRole === "admin") return "Administrador";
    return currentProfile?.name || "Sem perfil";
  }, [userRole, currentProfile]);

  // Core permission check
  const can = useCallback(
    (module: string, action: keyof ModulePermission): boolean => {
      if (userRole === "admin" || userRole === null) return true;
      if (!currentProfile) return action === "view";

      const modulePerms = currentProfile.permissions[module];
      if (!modulePerms) return false;

      return modulePerms[action] || false;
    },
    [userRole, currentProfile]
  );

  const canAny = useCallback(
    (module: string, ...actions: (keyof ModulePermission)[]): boolean => {
      return actions.some((action) => can(module, action));
    },
    [can]
  );

  const canAccessRoute = useCallback(
    (route: string): boolean => {
      const module = ROUTE_TO_MODULE[route];
      if (!module) return true;
      return can(module, "view");
    },
    [can]
  );

  const getModulePermissions = useCallback(
    (module: string): ModulePermission => {
      if (userRole === "admin" || userRole === null) return FULL_PERMISSION;

      if (!currentProfile) {
        return { view: true, add: false, edit: false, delete: false };
      }

      return (
        currentProfile.permissions[module] || {
          view: false,
          add: false,
          edit: false,
          delete: false,
        }
      );
    },
    [userRole, currentProfile]
  );

  return (
    <PermissionsContext.Provider
      value={{
        can,
        canAny,
        canAccessRoute,
        getModulePermissions,
        userRole,
        profileName,
        loaded,
        reloadProfiles,
        profiles,
        saveProfiles,
      }}
    >
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const ctx = useContext(PermissionsContext);

  if (!ctx) {
    return {
      can: () => true,
      canAny: () => true,
      canAccessRoute: () => true,
      getModulePermissions: () => FULL_PERMISSION,
      userRole: "admin" as const,
      profileName: "Administrador",
      loaded: false,
      reloadProfiles: () => {},
      profiles: [] as AccessProfile[],
      saveProfiles: async () => {},
    };
  }

  return ctx;
}

/** Route-to-module mapping export for sidebar filtering */
export { ROUTE_TO_MODULE };