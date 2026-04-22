import React, { useState, useCallback, useRef, useEffect } from "react";

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  placeholder?: string;
  className?: string;
  allowPercentage?: boolean;
}

function formatToBRL(rawDigits: string): string {
  if (!rawDigits) return "";
  const num = parseInt(rawDigits, 10);
  if (isNaN(num)) return "";
  const integerPart = Math.floor(num / 100);
  const decimalPart = (num % 100).toString().padStart(2, "0");
  const formattedInteger = integerPart.toLocaleString("pt-BR");
  return `${formattedInteger},${decimalPart}`;
}

function parseFromFormatted(formatted: string): string {
  // Extract only digits
  const digits = formatted.replace(/\D/g, "");
  return digits;
}

function formattedToNumber(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
}

export function CurrencyInput({
  value,
  onChange,
  prefix = "R$",
  placeholder = "0,00",
  className = "",
  allowPercentage = false,
}: CurrencyInputProps) {
  // Convert initial numeric string to formatted display
  const toDisplay = useCallback(
    (val: string) => {
      if (!val) return "";
      const numVal = parseFloat(val);
      if (isNaN(numVal)) return "";
      // Convert number to cents string
      const cents = Math.round(numVal * 100).toString();
      return formatToBRL(cents);
    },
    []
  );

  const [display, setDisplay] = useState(() => toDisplay(value));
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from outside when value changes externally
  useEffect(() => {
    const formatted = toDisplay(value);
    if (formatted !== display) {
      setDisplay(formatted);
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const digits = raw.replace(/\D/g, "");

      if (!digits) {
        setDisplay("");
        onChange("");
        return;
      }

      const formatted = formatToBRL(digits);
      setDisplay(formatted);
      // Pass raw number as string
      onChange(String(formattedToNumber(formatted)));
    },
    [onChange]
  );

  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-4 text-[12px] text-[#8a8a99] pointer-events-none select-none">
          {prefix}
        </span>
      )}
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-[#1c1c21] border border-white/[0.08] rounded-xl py-2.5 text-white text-[13px] focus:outline-none focus:border-[#FF0074]/40 ${
          prefix ? "pl-10 pr-4" : "px-4"
        } ${className}`}
      />
    </div>
  );
}

// Simple percentage input
export function PercentInput({
  value,
  onChange,
  placeholder = "0,00",
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(() => {
    if (!value) return "";
    const num = parseFloat(value);
    if (isNaN(num)) return "";
    return num.toString().replace(".", ",");
  });

  useEffect(() => {
    if (!value) {
      if (display) setDisplay("");
      return;
    }
    const expected = parseFloat(value);
    const current = parseFloat(display.replace(",", "."));
    if (isNaN(expected)) return;
    if (current !== expected) {
      setDisplay(expected.toString().replace(".", ","));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9,]/g, "");
    setDisplay(raw);
    const numStr = raw.replace(",", ".");
    onChange(numStr);
  };

  return (
    <div className="relative flex items-center">
      <input
        type="text"
        inputMode="decimal"
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        className={`w-full bg-[#1c1c21] border border-white/[0.08] rounded-xl py-2.5 pl-4 pr-8 text-white text-[13px] focus:outline-none focus:border-[#FF0074]/40 ${className}`}
      />
      <span className="absolute right-4 text-[12px] text-[#8a8a99] pointer-events-none select-none">
        %
      </span>
    </div>
  );
}
