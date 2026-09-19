"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type SSOption = { value: string; label: string };

/**
 * SearchableSelect — combobox con búsqueda, igual que en GastroCore.
 * Reemplaza a un <select> nativo permitiendo filtrar por texto.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona…",
  searchPlaceholder = "Buscar…",
  emptyLabel = "Sin resultados",
  disabled = false,
  allowClear = true,
  clearLabel = "— Sin selección —",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: SSOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  allowClear?: boolean;
  clearLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = useMemo(
    () => options.find((o) => String(o.value) === String(value)) || null,
    [options, value]
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t));
  }, [options, q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQ("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setQ("");
  }

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm focus:outline-none ${
          disabled ? "cursor-not-allowed bg-slate-50 text-slate-400" : "bg-white text-ink"
        }`}
        style={{ borderColor: "var(--line)" }}
      >
        <span className={selected ? "" : "text-slate-400"}>{selected ? selected.label : placeholder}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>

      {open && !disabled && (
        <div
          className="absolute z-[999] mt-1 w-full rounded-lg border bg-white shadow-lg"
          style={{ borderColor: "var(--line)" }}
        >
          <div className="border-b p-2" style={{ borderColor: "var(--line)" }}>
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]"
            />
          </div>
          <ul className="max-h-60 overflow-auto py-1">
            {allowClear && (
              <li>
                <button
                  type="button"
                  onClick={() => pick("")}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                    !value ? "font-semibold text-[#1E3A5F]" : "text-slate-600"
                  }`}
                >
                  {clearLabel}
                </button>
              </li>
            )}
            {filtered.length === 0 && <li className="px-3 py-2 text-sm text-slate-400">{emptyLabel}</li>}
            {filtered.map((o) => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => pick(o.value)}
                  className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                    String(o.value) === String(value) ? "bg-[#EFF6FF] font-semibold text-[#1E3A5F]" : "text-ink"
                  }`}
                >
                  {o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
