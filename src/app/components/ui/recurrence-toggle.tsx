import React, { useState, useRef, useEffect } from "react";
import { Repeat, Calendar, CalendarDays, CalendarClock, CalendarRange, Settings2, X } from "lucide-react";
import { CustomSelect } from "./custom-select";

export interface RecurrenceConfig {
  enabled: boolean;
  frequency: "daily" | "weekdays" | "weekly" | "monthly" | "yearly" | "custom";
  customInterval?: number;
  customUnit?: "dias" | "semanas" | "meses" | "anos";
}

interface RecurrenceToggleProps {
  value: RecurrenceConfig;
  onChange: (value: RecurrenceConfig) => void;
  compact?: boolean;
}

const frequencyOptions = [
  { key: "daily", label: "Diariamente", icon: Calendar },
  { key: "weekdays", label: "Dias da semana", icon: CalendarDays },
  { key: "weekly", label: "Semanalmente", icon: CalendarClock },
  { key: "monthly", label: "Mensalmente", icon: CalendarRange },
  { key: "yearly", label: "Anualmente", icon: CalendarRange },
  { key: "custom", label: "Personalizar", icon: Settings2 },
];

const frequencyLabels: Record<string, string> = {
  daily: "Diariamente",
  weekdays: "Dias da semana",
  weekly: "Semanalmente",
  monthly: "Mensalmente",
  yearly: "Anualmente",
  custom: "Personalizado",
};

export function RecurrenceToggle({ value, onChange, compact = false }: RecurrenceToggleProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [customInterval, setCustomInterval] = useState(String(value.customInterval || 1));
  const [customUnit, setCustomUnit] = useState<string>(value.customUnit || "meses");

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowMenu(false);
        setShowCustom(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggle = () => {
    if (value.enabled) {
      onChange({ enabled: false, frequency: "monthly" });
      setShowMenu(false);
      setShowCustom(false);
    } else {
      setShowMenu(true);
    }
  };

  const selectFrequency = (freq: string) => {
    if (freq === "custom") {
      setShowCustom(true);
      setShowMenu(false);
    } else {
      onChange({ enabled: true, frequency: freq as RecurrenceConfig["frequency"] });
      setShowMenu(false);
    }
  };

  const saveCustom = () => {
    onChange({
      enabled: true,
      frequency: "custom",
      customInterval: parseInt(customInterval) || 1,
      customUnit: customUnit as RecurrenceConfig["customUnit"],
    });
    setShowCustom(false);
  };

  const displayLabel = () => {
    if (!value.enabled) return null;
    if (value.frequency === "custom") {
      return `A cada ${value.customInterval || 1} ${value.customUnit || "meses"}`;
    }
    return frequencyLabels[value.frequency] || "";
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-3">
        {/* Toggle Switch */}
        <button
          type="button"
          onClick={handleToggle}
          className="flex items-center gap-2 group"
        >
          <div
            className={`w-9 h-5 rounded-full transition-all relative ${
              value.enabled ? "" : "bg-white/[0.1]"
            }`}
            style={value.enabled ? { backgroundColor: "var(--accent)" } : {}}
          >
            <div
              className={`w-4 h-4 rounded-full absolute top-0.5 transition-all ${
                value.enabled ? "left-[18px]" : "left-0.5"
              }`}
              style={{ backgroundColor: value.enabled ? "var(--accent-foreground)" : "white" }}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Repeat className="w-3.5 h-3.5" style={{ color: value.enabled ? "var(--accent)" : "#8a8a99" }} />
            <span className={`text-[13px] ${value.enabled ? "text-white" : "text-[#8a8a99]"}`}>
              Repetir
            </span>
          </div>
        </button>

        {/* Active Badge */}
        {value.enabled && (
          <button
            type="button"
            onClick={() => setShowMenu(!showMenu)}
            className="text-[11px] border px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            style={{ backgroundColor: "rgba(var(--accent-rgb),0.1)", color: "var(--accent)", borderColor: "rgba(var(--accent-rgb),0.2)" }}
          >
            {displayLabel()}
          </button>
        )}
      </div>

      {/* Frequency Menu */}
      {showMenu && (
        <div className="absolute z-50 mt-2 w-[220px] bg-[#131316] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden">
          <div className="p-1.5">
            {frequencyOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = value.enabled && value.frequency === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => selectFrequency(opt.key)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
                    isSelected
                      ? "bg-[#FF0074]/10 text-[#FF0074]"
                      : "text-white hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="w-4 h-4 text-[#8a8a99]" />
                  <span className="text-[13px]">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom Interval */}
      {showCustom && (
        <div className="absolute z-50 mt-2 w-[240px] bg-[#131316] border border-white/[0.08] rounded-xl shadow-2xl p-4 space-y-3">
          <p className="text-[13px] text-white" style={{ fontWeight: 500 }}>
            Repetir a cada...
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              inputMode="numeric"
              value={customInterval}
              onChange={(e) => setCustomInterval(e.target.value.replace(/\D/g, ""))}
              className="w-16 bg-[#1c1c21] border border-white/[0.08] rounded-xl px-3 py-2 text-white text-[13px] text-center focus:outline-none focus:border-[#FF0074]/40"
            />
            <div className="flex-1">
              <CustomSelect
                options={[
                  { value: "dias", label: "dias" },
                  { value: "semanas", label: "semanas" },
                  { value: "meses", label: "meses" },
                  { value: "anos", label: "anos" },
                ]}
                value={customUnit}
                onChange={setCustomUnit}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setShowCustom(false)}
              className="flex-1 px-3 py-2 text-[12px] text-[#8a8a99] bg-white/[0.04] rounded-xl hover:bg-white/[0.08] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={saveCustom}
              className="flex-1 px-3 py-2 text-[12px] rounded-xl hover:opacity-90 transition-colors"
              style={{ backgroundColor: "var(--accent)", color: "var(--accent-foreground)", fontWeight: 500 }}
            >
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper: convert RecurrenceConfig to a simple string for storage
export function recurrenceConfigToString(config: RecurrenceConfig): string {
  if (!config.enabled) return "Unica";
  switch (config.frequency) {
    case "daily": return "Diario";
    case "weekdays": return "Dias uteis";
    case "weekly": return "Semanal";
    case "monthly": return "Mensal";
    case "yearly": return "Anual";
    case "custom":
      return `A cada ${config.customInterval || 1} ${config.customUnit || "meses"}`;
    default: return "Mensal";
  }
}

// Helper: parse a simple string back to RecurrenceConfig
export function stringToRecurrenceConfig(str?: string): RecurrenceConfig {
  if (!str || str === "Unica" || str === "Única") return { enabled: false, frequency: "monthly" };
  switch (str.toLowerCase()) {
    case "diario":
    case "diariamente": return { enabled: true, frequency: "daily" };
    case "semanal":
    case "semanalmente": return { enabled: true, frequency: "weekly" };
    case "mensal":
    case "mensalmente": return { enabled: true, frequency: "monthly" };
    case "anual":
    case "anualmente": return { enabled: true, frequency: "yearly" };
    case "dias uteis": return { enabled: true, frequency: "weekdays" };
    default:
      // Try to parse custom "A cada X unit"
      const match = str.match(/a cada (\d+) (\w+)/i);
      if (match) {
        return {
          enabled: true,
          frequency: "custom",
          customInterval: parseInt(match[1]),
          customUnit: match[2] as any,
        };
      }
      return { enabled: true, frequency: "monthly" };
  }
}