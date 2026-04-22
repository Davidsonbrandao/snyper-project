import { useTheme } from "../../lib/theme-context";
import svgPathsDark from "../../../imports/svg-1bhg9cv1vb";
import svgPathsLight from "../../../imports/svg-t241641r03";

interface LogoProps {
  className?: string;
  variant?: "full" | "mark" | "text";
  /** Force a specific mode instead of reading from theme */
  forceMode?: "dark" | "light";
}

const ICON_COLOR = "#00FA64";
// Text dark (for light mode backgrounds) — matches Figma "LogoSnyperPreta"
const TEXT_DARK = "#0F1C13";
// Text white (for dark mode backgrounds) — matches Figma "LogoSnyperBranca"
const TEXT_LIGHT = "#ffffff";

// Full logo viewBox: 0 0 1128.48 307.213
// Icon occupies x: 0–220, y: 0–308 (the green S-mark)
// Text occupies x: 319–1128, y: 55–308 (the "Snyper" wordmark)

export function Logo({ className = "", variant = "full", forceMode }: LogoProps) {
  const { mode } = useTheme();
  const isDark = (forceMode ?? mode) === "dark";
  const textColor = isDark ? TEXT_LIGHT : TEXT_DARK;

  // ── MARK: only the S-shaped icon ──────────────────────────────
  if (variant === "mark") {
    const iconPath = isDark ? svgPathsLight.p12528f80 : svgPathsDark.p9f23400;
    return (
      <svg
        className={`block ${className}`}
        viewBox="0 0 220 309"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Snyper icon"
        role="img"
      >
        <path d={iconPath} fill={ICON_COLOR} />
      </svg>
    );
  }

  // ── TEXT: only the "Snyper" wordmark ──────────────────────────
  if (variant === "text") {
    if (isDark) {
      return (
        <svg
          className={`block ${className}`}
          viewBox="319 55 810 253"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="Snyper"
          role="img"
        >
          <path d={svgPathsLight.p11d70470} fill={textColor} />
          <path d={svgPathsLight.p16e78f80} fill={textColor} />
          <path d={svgPathsLight.p30c4cf00} fill={textColor} />
          <path d={svgPathsLight.p25cadd00} fill={textColor} />
          <path clipRule="evenodd" d={svgPathsLight.p13ed4140} fill={textColor} fillRule="evenodd" />
          <path d={svgPathsLight.p1d350f00} fill={textColor} />
        </svg>
      );
    }
    return (
      <svg
        className={`block ${className}`}
        viewBox="319 55 810 253"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Snyper"
        role="img"
      >
        <path d={svgPathsDark.p3118a100} fill={textColor} />
        <path d={svgPathsDark.p246ff100} fill={textColor} />
        <path d={svgPathsDark.p1a210780} fill={textColor} />
        <path d={svgPathsDark.p3a7fac00} fill={textColor} />
        <path clipRule="evenodd" d={svgPathsDark.p19c00a80} fill={textColor} fillRule="evenodd" />
        <path d={svgPathsDark.p3b3fee80} fill={textColor} />
      </svg>
    );
  }

  // ── FULL: icon + wordmark ─────────────────────────────────────
  if (isDark) {
    return (
      <svg
        className={`block ${className}`}
        viewBox="0 0 1128.48 307.214"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Snyper"
        role="img"
      >
        {/* Icon */}
        <path d={svgPathsLight.p12528f80} fill={ICON_COLOR} />
        {/* Wordmark — white */}
        <path d={svgPathsLight.p11d70470} fill={textColor} />
        <path d={svgPathsLight.p16e78f80} fill={textColor} />
        <path d={svgPathsLight.p30c4cf00} fill={textColor} />
        <path d={svgPathsLight.p25cadd00} fill={textColor} />
        <path clipRule="evenodd" d={svgPathsLight.p13ed4140} fill={textColor} fillRule="evenodd" />
        <path d={svgPathsLight.p1d350f00} fill={textColor} />
      </svg>
    );
  }

  return (
    <svg
      className={`block ${className}`}
      viewBox="0 0 1128.48 307.213"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Snyper"
      role="img"
    >
      {/* Icon */}
      <path d={svgPathsDark.p9f23400} fill={ICON_COLOR} />
      {/* Wordmark — dark */}
      <path d={svgPathsDark.p3118a100} fill={textColor} />
      <path d={svgPathsDark.p246ff100} fill={textColor} />
      <path d={svgPathsDark.p1a210780} fill={textColor} />
      <path d={svgPathsDark.p3a7fac00} fill={textColor} />
      <path clipRule="evenodd" d={svgPathsDark.p19c00a80} fill={textColor} fillRule="evenodd" />
      <path d={svgPathsDark.p3b3fee80} fill={textColor} />
    </svg>
  );
}
