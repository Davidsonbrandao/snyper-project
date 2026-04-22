import { useState, useRef, useEffect } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DatePickerInput } from "./date-picker-input";

export interface PeriodOption {
  key: string;
  label: string;
}

interface PeriodFilterProps {
  options: PeriodOption[];
  value: string;
  onChange: (key: string) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
  showCustomOption?: boolean;
}

export function PeriodFilter({
  options,
  value,
  onChange,
  customFrom = "",
  customTo = "",
  onCustomChange,
  showCustomOption = true,
}: PeriodFilterProps) {
  const allOptions = showCustomOption
    ? [...options, { key: "custom", label: "Personalizado" }]
    : options;

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 p-1 bg-[#131316] rounded-xl w-fit border border-white/[0.06]">
        {allOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => onChange(opt.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-[12px] transition-all ${
              value === opt.key ? "" : "text-[#8a8a99] hover:text-white hover:bg-white/[0.04]"
            }`}
            style={{
              fontWeight: value === opt.key ? 500 : 400,
              ...(value === opt.key ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" } : {})
            }}
          >
            {opt.key === "custom" && <CalendarDays className="w-3.5 h-3.5" />}
            {opt.label}
          </button>
        ))}
      </div>

      {/* Custom date range inputs */}
      {value === "custom" && onCustomChange && (
        <div className="flex items-center gap-2 ml-2">
          <div className="w-[160px]">
            <DatePickerInput
              value={customFrom}
              onChange={from => onCustomChange(from, customTo)}
              placeholder="Data inicio"
              showShortcuts={false}
            />
          </div>
          <span className="text-[12px] text-[#8a8a99]">ate</span>
          <div className="w-[160px]">
            <DatePickerInput
              value={customTo}
              onChange={to => onCustomChange(customFrom, to)}
              placeholder="Data fim"
              showShortcuts={false}
            />
          </div>
          {customFrom && customTo && (
            <span className="text-[11px] text-[#FF0074] ml-1" style={{ fontWeight: 500 }}>
              {Math.ceil((new Date(customTo + "T12:00:00").getTime() - new Date(customFrom + "T12:00:00").getTime()) / (1000 * 60 * 60 * 24))} dias
            </span>
          )}
        </div>
      )}
    </div>
  );
}