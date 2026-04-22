import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check, X } from "lucide-react";

export interface MultiOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  searchable?: boolean;
  disabled?: boolean;
}

export function MultiSelect({ options, value, onChange, placeholder = "Selecione...", searchable = false, disabled = false }: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        const portal = document.getElementById("multi-select-portal");
        if (portal && portal.contains(event.target as Node)) return;
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = Math.min(options.length * 36 + (searchable ? 44 : 0) + 8, 250);
      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight - 4 : rect.bottom + 4;
      setDropdownPos({ top, left: rect.left, width: rect.width });
    }
  }, [isOpen, options.length, searchable]);

  const filtered = search ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase())) : options;
  const selectedLabels = value.map(v => options.find(o => o.value === v)?.label).filter(Boolean);

  const toggleOption = (optValue: string) => {
    if (value.includes(optValue)) {
      onChange(value.filter(v => v !== optValue));
    } else {
      onChange([...value, optValue]);
    }
  };

  const removeOption = (optValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optValue));
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="w-full flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] text-left transition-colors min-h-[42px] flex-wrap"
        style={{
          backgroundColor: "var(--bg-input)",
          border: "1px solid var(--border-default)",
          color: value.length > 0 ? "var(--text-primary)" : "var(--text-muted)",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <div className="flex-1 flex flex-wrap gap-1 min-w-0">
          {value.length === 0 && <span>{placeholder}</span>}
          {selectedLabels.map((label, i) => (
            <span
              key={value[i]}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px]"
              style={{ backgroundColor: "rgba(var(--accent-rgb),0.15)", color: "var(--accent)", fontWeight: 500 }}
            >
              {label}
              <X className="w-3 h-3 cursor-pointer hover:opacity-70" onClick={(e) => removeOption(value[i], e)} />
            </span>
          ))}
        </div>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
      </button>

      {isOpen && dropdownPos && createPortal(
        <div
          id="multi-select-portal"
          className="fixed z-[9999] rounded-xl shadow-2xl overflow-hidden"
          style={{
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            backgroundColor: "var(--bg-input)",
            border: "1px solid var(--border-default)",
          }}
        >
          {searchable && (
            <div className="p-2" style={{ borderBottom: "1px solid var(--border-extra-subtle)" }}>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--text-muted)" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  autoFocus
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg text-[12px] focus:outline-none"
                  style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border-subtle)" }}
                />
              </div>
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto custom-scrollbar py-1">
            {filtered.length === 0 && (
              <p className="text-[12px] text-center py-3" style={{ color: "var(--text-muted)" }}>Nenhuma opcao encontrada</p>
            )}
            {filtered.map(opt => {
              const isSelected = value.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleOption(opt.value)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-left transition-colors"
                  style={{
                    color: isSelected ? "var(--accent)" : "var(--text-secondary)",
                    backgroundColor: isSelected ? "rgba(var(--accent-rgb),0.05)" : "transparent",
                  }}
                >
                  <div
                    className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                    style={{
                      borderColor: isSelected ? "var(--accent)" : "var(--border-default)",
                      backgroundColor: isSelected ? "rgba(var(--accent-rgb),0.2)" : "transparent",
                    }}
                  >
                    {isSelected && <Check className="w-3 h-3" style={{ color: "var(--accent)" }} />}
                  </div>
                  <span className="flex-1 truncate">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
