import React, { useState, useRef, useEffect, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { createPortal } from "react-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths, isSameDay, isSameMonth, isToday, addDays, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DatePickerInputProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  showShortcuts?: boolean;
}

export function DatePickerInput({
  value,
  onChange,
  placeholder = "Selecionar data",
  className = "",
  showShortcuts = true,
}: DatePickerInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);
  const selectedDate = value ? new Date(value + "T12:00:00") : null;
  const [viewMonth, setViewMonth] = useState(() => selectedDate || new Date());

  const portalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        // Also check if clicking inside the portal dropdown
        if (portalRef.current && portalRef.current.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (selectedDate && !isSameMonth(selectedDate, viewMonth)) {
      setViewMonth(selectedDate);
    }
  }, [value]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const calStart = startOfWeek(monthStart, { locale: ptBR });
    const calEnd = endOfWeek(monthEnd, { locale: ptBR });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewMonth]);

  const weekDays = ["D", "S", "T", "Q", "Q", "S", "S"];

  const selectDate = (date: Date) => {
    onChange(format(date, "yyyy-MM-dd"));
    setIsOpen(false);
  };

  const today = new Date();
  const tomorrow = addDays(today, 1);
  const nextWeekDay = addDays(today, 7 - today.getDay() || 7);

  const shortcuts = [
    { label: "Hoje", date: today, sub: format(today, "EEE", { locale: ptBR }) },
    { label: "Amanha", date: tomorrow, sub: format(tomorrow, "EEE", { locale: ptBR }) },
    { label: "Proxima semana", date: nextWeekDay, sub: format(nextWeekDay, "EEE", { locale: ptBR }) },
  ];

  const handleToggle = () => {
    if (!isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = 420;
      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 4 : rect.bottom + 8;
      const left = Math.min(rect.left, window.innerWidth - 290);
      setDropdownPos({ top, left });
    }
    setIsOpen(!isOpen);
  };

  const displayValue = selectedDate
    ? format(selectedDate, "dd/MM/yyyy")
    : "";

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between bg-[#1c1c21] border border-white/[0.08] hover:border-[#FF0074]/40 transition-colors rounded-xl px-4 py-2.5 outline-none text-[13px]"
      >
        <span className={displayValue ? "text-white" : "text-[#8a8a99]"}>
          {displayValue || placeholder}
        </span>
        <Calendar className="w-4 h-4 text-[#8a8a99] shrink-0" />
      </button>

      {isOpen && dropdownPos && createPortal(
        <div
          ref={portalRef}
          className="fixed z-[9999] w-[280px] bg-[#131316] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          {/* Shortcuts */}
          {showShortcuts && (
            <div className="border-b border-white/[0.06]">
              {shortcuts.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => selectDate(s.date)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.04] transition-colors"
                >
                  <Calendar className="w-4 h-4 text-[#8a8a99]" />
                  <span className="flex-1 text-[13px] text-white">{s.label}</span>
                  <span className="text-[12px] text-[#8a8a99]">{s.sub}</span>
                </button>
              ))}
            </div>
          )}

          {/* Calendar Header */}
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-[13px] text-white" style={{ fontWeight: 500 }}>
              {format(viewMonth, "MMMM 'de' yyyy", { locale: ptBR })}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setViewMonth(subMonths(viewMonth, 1))}
                className="p-1 rounded-lg hover:bg-white/[0.06] text-[#8a8a99] hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                className="p-1 rounded-lg hover:bg-white/[0.06] text-[#8a8a99] hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 px-3">
            {weekDays.map((d, i) => (
              <div key={i} className="text-center text-[11px] text-[#8a8a99] py-1" style={{ fontWeight: 500 }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-3 pb-2">
            {calendarDays.map((day, i) => {
              const inMonth = isSameMonth(day, viewMonth);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={`
                    w-full aspect-square flex items-center justify-center rounded-lg text-[12px] transition-all
                    ${!inMonth ? "text-white/[0.15]" : "text-white hover:bg-white/[0.06]"}
                    ${isTodayDate && !isSelected ? "border" : ""}
                  `}
                  style={isSelected
                    ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }
                    : isTodayDate ? { borderColor: "rgba(var(--accent-rgb),0.4)" } : {}}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setIsOpen(false);
              }}
              className="text-[12px] text-[#8a8a99] hover:text-white transition-colors"
            >
              Limpar
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-[12px] hover:underline transition-colors"
              style={{ fontWeight: 500, color: "var(--accent)" }}
            >
              Fechar
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Simple day-of-month picker for recurring expenses
export function DayPickerInput({
  value,
  onChange,
  placeholder = "Dia",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-[#1c1c21] border border-white/[0.08] hover:border-[#FF0074]/40 transition-colors rounded-xl px-4 py-2.5 outline-none text-[13px]"
      >
        <span className={value ? "text-white" : "text-[#8a8a99]"}>
          {value ? `Dia ${value}` : placeholder}
        </span>
        <Calendar className="w-4 h-4 text-[#8a8a99] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-[220px] bg-[#131316] border border-white/[0.08] rounded-xl shadow-2xl p-3">
          <p className="text-[11px] text-[#8a8a99] mb-2 px-1">Dia do vencimento</p>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => {
                  onChange(String(d).padStart(2, "0"));
                  setIsOpen(false);
                }}
                className={`
                  w-full aspect-square flex items-center justify-center rounded-lg text-[12px] transition-all
                `}
                style={value === String(d).padStart(2, "0") || value === String(d)
                  ? { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" }
                  : { color: "var(--text-primary)" }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}