import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search, Check } from "lucide-react";

export interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  allowCreate?: boolean;
  onCreate?: (value: string) => void;
  disabled?: boolean;
}

export function CustomSelect({ options, value, onChange, placeholder = "Selecione...", searchable = false, allowCreate = false, onCreate, disabled = false }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; maxHeight: number } | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current && !containerRef.current.contains(event.target as Node) &&
        portalRef.current && !portalRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Recalculate position on scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    function updatePos() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const DROPDOWN_MAX = 280;
      const MARGIN = 8;

      const spaceBelow = vh - rect.bottom - MARGIN;
      const spaceAbove = rect.top - MARGIN;

      let top: number;
      let maxHeight: number;

      if (spaceBelow >= Math.min(DROPDOWN_MAX, 180) || spaceBelow >= spaceAbove) {
        // Open below
        top = rect.bottom + 4;
        maxHeight = Math.min(DROPDOWN_MAX, spaceBelow);
      } else {
        // Open above
        maxHeight = Math.min(DROPDOWN_MAX, spaceAbove);
        top = rect.top - maxHeight - 4;
      }

      // Clamp to viewport
      top = Math.max(MARGIN, Math.min(top, vh - maxHeight - MARGIN));

      // Horizontal: keep within viewport
      let left = rect.left;
      if (left + rect.width > vw - MARGIN) left = vw - rect.width - MARGIN;
      if (left < MARGIN) left = MARGIN;

      setDropdownPos({ top, left, width: rect.width, maxHeight: Math.max(80, maxHeight) });
    }
    updatePos();
    window.addEventListener("scroll", updatePos, true);
    window.addEventListener("resize", updatePos);
    return () => {
      window.removeEventListener("scroll", updatePos, true);
      window.removeEventListener("resize", updatePos);
    };
  }, [isOpen]);

  const selectedOption = options.find((o) => o.value === value);
  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) setSearch("");
    setIsOpen(!isOpen);
  };

  const dropdown = isOpen && dropdownPos && createPortal(
    <div
      ref={portalRef}
      className="fixed z-[9999] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      style={{
        top: dropdownPos.top,
        left: dropdownPos.left,
        width: dropdownPos.width,
        maxHeight: dropdownPos.maxHeight,
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-default)",
      }}
    >
      {searchable && (
        <div className="flex items-center px-3 py-2.5 shrink-0" style={{ borderBottom: "1px solid var(--border-subtle)", backgroundColor: "var(--bg-input)" }}>
          <Search className="w-4 h-4 mr-2 shrink-0" style={{ color: "var(--text-muted)" }} />
          <input
            autoFocus
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (allowCreate && search && !options.find(o => o.label.toLowerCase() === search.toLowerCase())) {
                  if (onCreate) onCreate(search);
                  onChange(search);
                  setIsOpen(false);
                } else if (filteredOptions.length > 0) {
                  onChange(filteredOptions[0].value);
                  setIsOpen(false);
                }
              }
            }}
            className="w-full bg-transparent border-none outline-none text-[13px]"
            style={{ color: "var(--text-primary)" }}
          />
        </div>
      )}
      <div className="overflow-y-auto p-1.5 flex flex-col gap-0.5 custom-scrollbar">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className="flex items-center justify-between w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors"
              style={{
                backgroundColor: value === option.value ? "rgba(var(--accent-rgb),0.1)" : "transparent",
                color: value === option.value ? "var(--accent)" : "var(--text-secondary)",
                fontWeight: value === option.value ? 500 : 400,
              }}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check className="w-4 h-4 shrink-0 ml-2" />}
            </button>
          ))
        ) : null}

        {allowCreate && search && !options.find(o => o.label.toLowerCase() === search.toLowerCase()) && (
          <button
            type="button"
            onClick={() => {
              if (onCreate) onCreate(search);
              onChange(search);
              setIsOpen(false);
            }}
            className="flex items-center w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors"
            style={{ color: "var(--accent)" }}
          >
            <span className="truncate">+ Criar "{search}"</span>
          </button>
        )}

        {filteredOptions.length === 0 && (!allowCreate || !search) && (
          <div className="px-3 py-4 text-center text-[12px]" style={{ color: "var(--text-muted)" }}>
            Nenhum resultado encontrado.
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="relative" ref={containerRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className="w-full flex items-center justify-between transition-colors rounded-xl px-4 py-2.5 outline-none text-[13px] disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ backgroundColor: "var(--bg-input)", border: "1px solid var(--border-default)", color: "var(--text-primary)" }}
      >
        <span className="truncate" style={{ color: selectedOption || value ? "var(--text-primary)" : "var(--text-muted)" }}>
          {selectedOption ? selectedOption.label : (value || placeholder)}
        </span>
        <ChevronDown className={`w-4 h-4 transition-transform ml-2 shrink-0 ${isOpen ? "rotate-180" : ""}`} style={{ color: "var(--text-muted)" }} />
      </button>
      {dropdown}
    </div>
  );
}