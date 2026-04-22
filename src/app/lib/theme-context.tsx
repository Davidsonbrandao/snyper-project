import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./auth-context";
import { apiFetch } from "./supabase";

// ========== Accent Color Presets ==========
export const ACCENT_PRESETS = [
  { id: "verde-snyper", label: "Snyper Verde", hex: "#00FA64" },
  { id: "azul", label: "Azul", hex: "#2563eb" },
  { id: "roxo", label: "Roxo", hex: "#7c3aed" },
  { id: "rosa", label: "Rosa", hex: "#FF0074" },
  { id: "laranja", label: "Laranja", hex: "#ea580c" },
  { id: "ciano", label: "Ciano", hex: "#0891b2" },
  { id: "vermelho", label: "Vermelho", hex: "#dc2626" },
  { id: "ambar", label: "Ambar", hex: "#d97706" },
  { id: "chumbo", label: "Chumbo", hex: "#475569" },
  { id: "cinza", label: "Cinza", hex: "#6b7280" },
] as const;

export type ThemeMode = "dark" | "light";

// ========== Light / Dark palettes ==========
const DARK_PALETTE = {
  "--bg-base": "#0a0a0b",
  "--bg-surface": "#0e0e10",
  "--bg-card": "#131316",
  "--bg-input": "#1c1c21",
  "--bg-sidebar": "#0e0e10",
  "--bg-sidebar-alt": "#0d0d10",
  "--bg-hover": "rgba(255,255,255,0.04)",
  "--bg-hover-strong": "rgba(255,255,255,0.06)",
  "--text-primary": "#ffffff",
  "--text-secondary": "#8a8a99",
  "--text-muted": "#5a5a6e",
  "--border-default": "rgba(255,255,255,0.08)",
  "--border-subtle": "rgba(255,255,255,0.06)",
  "--border-extra-subtle": "rgba(255,255,255,0.04)",
  "--border-strong": "rgba(255,255,255,0.12)",
  "--shadow-card": "none",
  "--scrollbar-thumb": "rgba(255,255,255,0.1)",
  "--invert-icon": "1",
};

const LIGHT_PALETTE = {
  "--bg-base": "#f4f5f9",
  "--bg-surface": "#edeef3",
  "--bg-card": "#ffffff",
  "--bg-input": "#f0f1f5",
  "--bg-sidebar": "#ffffff",
  "--bg-sidebar-alt": "#f8f9fb",
  "--bg-hover": "rgba(0,0,0,0.03)",
  "--bg-hover-strong": "rgba(0,0,0,0.05)",
  "--text-primary": "#111827",
  "--text-secondary": "#6b7280",
  "--text-muted": "#9ca3af",
  "--border-default": "rgba(0,0,0,0.08)",
  "--border-subtle": "rgba(0,0,0,0.05)",
  "--border-extra-subtle": "rgba(0,0,0,0.03)",
  "--border-strong": "rgba(0,0,0,0.12)",
  "--shadow-card": "0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.06)",
  "--scrollbar-thumb": "rgba(0,0,0,0.15)",
  "--invert-icon": "0",
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

/** Darken/lighten a hex color by a percentage */
function adjustColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const adjust = (c: number) => Math.max(0, Math.min(255, Math.round(c + (percent / 100) * 255)));
  return `#${[adjust(rgb.r), adjust(rgb.g), adjust(rgb.b)].map(c => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Returns the most readable text color for a given background accent */
function getAccentForeground(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#ffffff";
  // Perceived luminance (ITU-R BT.601)
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.55 ? "#0a0a0b" : "#ffffff";
}

// ========== Context ==========
interface ThemeContextType {
  mode: ThemeMode;
  accent: string;
  setMode: (mode: ThemeMode) => void;
  setAccent: (hex: string) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const LOCAL_KEY = "@pilar:theme";

function loadLocal(): { mode: ThemeMode; accent: string } {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        mode: parsed.mode === "light" ? "light" : "dark",
        accent: parsed.accent || "#00FA64",
      };
    }
  } catch {}
  return { mode: "dark", accent: "#00FA64" };
}

function saveLocal(mode: ThemeMode, accent: string) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify({ mode, accent }));
  } catch {}
}

function applyTheme(mode: ThemeMode, accent: string) {
  const root = document.documentElement;

  // Set data attributes
  root.setAttribute("data-theme", mode);
  root.setAttribute("data-accent", accent);

  // Apply palette
  const palette = mode === "light" ? LIGHT_PALETTE : DARK_PALETTE;
  for (const [key, value] of Object.entries(palette)) {
    root.style.setProperty(key, value);
  }

  // Apply accent color + computed variants
  const rgb = hexToRgb(accent);
  const accentFg = getAccentForeground(accent);
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-dark", adjustColor(accent, -15));
  root.style.setProperty("--accent-foreground", accentFg);
  root.style.setProperty("--primary-foreground", accentFg);
  if (rgb) {
    root.style.setProperty("--accent-rgb", `${rgb.r}, ${rgb.g}, ${rgb.b}`);
  }

  // Update theme.css variables
  root.style.setProperty("--primary", accent);
  root.style.setProperty("--accent-css", accent);
  root.style.setProperty("--ring", accent);
  root.style.setProperty("--sidebar-primary", accent);
  root.style.setProperty("--sidebar-primary-foreground", accentFg);
  root.style.setProperty("--sidebar-ring", accent);
  root.style.setProperty("--chart-1", accent);
  root.style.setProperty("--color-brand", accent);
  root.style.setProperty("--color-brand-dark", adjustColor(accent, -15));

  // Mode-specific overrides for theme.css vars
  if (mode === "light") {
    root.style.setProperty("--background", LIGHT_PALETTE["--bg-base"]);
    root.style.setProperty("--foreground", LIGHT_PALETTE["--text-primary"]);
    root.style.setProperty("--card", LIGHT_PALETTE["--bg-card"]);
    root.style.setProperty("--card-foreground", LIGHT_PALETTE["--text-primary"]);
    root.style.setProperty("--popover", LIGHT_PALETTE["--bg-card"]);
    root.style.setProperty("--popover-foreground", LIGHT_PALETTE["--text-primary"]);
    root.style.setProperty("--secondary", LIGHT_PALETTE["--bg-input"]);
    root.style.setProperty("--secondary-foreground", LIGHT_PALETTE["--text-primary"]);
    root.style.setProperty("--muted", LIGHT_PALETTE["--bg-input"]);
    root.style.setProperty("--muted-foreground", LIGHT_PALETTE["--text-secondary"]);
    root.style.setProperty("--border", LIGHT_PALETTE["--border-default"]);
    root.style.setProperty("--input", LIGHT_PALETTE["--border-default"]);
    root.style.setProperty("--input-background", LIGHT_PALETTE["--bg-input"]);
    root.style.setProperty("--switch-background", "#d1d5db");
    root.style.setProperty("--sidebar", LIGHT_PALETTE["--bg-sidebar"]);
    root.style.setProperty("--sidebar-foreground", LIGHT_PALETTE["--text-primary"]);
    root.style.setProperty("--sidebar-accent", LIGHT_PALETTE["--bg-input"]);
    root.style.setProperty("--sidebar-accent-foreground", LIGHT_PALETTE["--text-primary"]);
    root.style.setProperty("--sidebar-border", LIGHT_PALETTE["--border-default"]);
  } else {
    root.style.setProperty("--background", DARK_PALETTE["--bg-base"]);
    root.style.setProperty("--foreground", "#f0f0f2");
    root.style.setProperty("--card", DARK_PALETTE["--bg-card"]);
    root.style.setProperty("--card-foreground", "#f0f0f2");
    root.style.setProperty("--popover", DARK_PALETTE["--bg-card"]);
    root.style.setProperty("--popover-foreground", "#f0f0f2");
    root.style.setProperty("--secondary", DARK_PALETTE["--bg-input"]);
    root.style.setProperty("--secondary-foreground", "#f0f0f2");
    root.style.setProperty("--muted", DARK_PALETTE["--bg-input"]);
    root.style.setProperty("--muted-foreground", DARK_PALETTE["--text-secondary"]);
    root.style.setProperty("--border", DARK_PALETTE["--border-default"]);
    root.style.setProperty("--input", DARK_PALETTE["--border-default"]);
    root.style.setProperty("--input-background", DARK_PALETTE["--bg-input"]);
    root.style.setProperty("--switch-background", "#2a2a32");
    root.style.setProperty("--sidebar", DARK_PALETTE["--bg-sidebar"]);
    root.style.setProperty("--sidebar-foreground", "#f0f0f2");
    root.style.setProperty("--sidebar-accent", DARK_PALETTE["--bg-input"]);
    root.style.setProperty("--sidebar-accent-foreground", "#f0f0f2");
    root.style.setProperty("--sidebar-border", DARK_PALETTE["--border-subtle"]);
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, session } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>(() => loadLocal().mode);
  const [accent, setAccentState] = useState(() => loadLocal().accent);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();
  const initialized = useRef(false);

  // Apply theme on mount and changes
  useEffect(() => {
    applyTheme(mode, accent);
  }, [mode, accent]);

  // Load from server on auth
  useEffect(() => {
    if (!user || !session?.access_token) return;
    let cancelled = false;
    apiFetch("/theme")
      .then((data) => {
        if (cancelled || !data) return;
        if (data.mode) setModeState(data.mode);
        if (data.accent) setAccentState(data.accent);
        initialized.current = true;
      })
      .catch(() => {
        if (!cancelled) initialized.current = true;
      });
    return () => { cancelled = true; };
  }, [user, session?.access_token]);

  // Save to server with debounce
  const saveToServer = useCallback(() => {
    if (!user || !session?.access_token || !initialized.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      apiFetch("/theme", {
        method: "POST",
        body: JSON.stringify({ mode, accent }),
      }).catch((err) => console.error("Erro ao salvar tema:", err));
    }, 1000);
  }, [user, session?.access_token, mode, accent]);

  const setMode = useCallback((m: ThemeMode) => {
    setModeState(m);
    saveLocal(m, accent);
    // save will be triggered by effect
  }, [accent]);

  const setAccent = useCallback((hex: string) => {
    setAccentState(hex);
    saveLocal(mode, hex);
  }, [mode]);

  const toggleMode = useCallback(() => {
    const newMode = mode === "dark" ? "light" : "dark";
    setMode(newMode);
  }, [mode, setMode]);

  // Trigger server save when mode/accent change
  useEffect(() => {
    if (initialized.current) {
      saveToServer();
    }
  }, [mode, accent, saveToServer]);

  return (
    <ThemeContext.Provider value={{ mode, accent, setMode, setAccent, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      mode: "dark" as ThemeMode,
      accent: "#FF0074",
      setMode: () => {},
      setAccent: () => {},
      toggleMode: () => {},
    };
  }
  return ctx;
}