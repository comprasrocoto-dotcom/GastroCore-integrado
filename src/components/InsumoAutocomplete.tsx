"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export type ItemOpt = {
  id: string;
  tipo_item: "insumo" | "subreceta";
  articulo: string;
  referencia: string | null;
  unidad: string | null;
  coste: number;
  subfamilia?: string | null;
  merma_std?: number;
};

function norm(s: string): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function money(n: number): string {
  const v = Number(n) || 0;
  return "$" + v.toLocaleString("es-CO", { maximumFractionDigits: 2 });
}

/**
 * InsumoAutocomplete — buscador tipo ERP, igual que en GastroCore.
 * Filtra en tiempo real por nombre/referencia, insensible a
 * mayúsculas/tildes. Navegación por teclado (flechas, Enter, Escape, Tab).
 * No consulta la base por cada tecla: usa un índice en memoria.
 */
export default function InsumoAutocomplete({
  value,
  items,
  onSelect,
  existingIds = [],
  onCommit,
  placeholder = "Buscar insumo o subreceta…",
}: {
  value: string;
  items: ItemOpt[];
  onSelect: (item: ItemOpt) => void;
  existingIds?: string[];
  onCommit?: () => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [dupWarn, setDupWarn] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const index = useMemo(
    () =>
      items.map((i) => ({
        item: i,
        hay: norm(i.articulo) + " " + norm(i.referencia ?? "") + " " + norm(i.id),
      })),
    [items]
  );

  const seleccionado = useMemo(() => items.find((i) => i.id === value) || null, [items, value]);

  const resultados = useMemo(() => {
    const nq = norm(q);
    if (!nq) return index.slice(0, 50).map((x) => x.item);
    const terms = nq.split(" ").filter(Boolean);
    const out: ItemOpt[] = [];
    for (const x of index) {
      let ok = true;
      for (const t of terms) {
        if (x.hay.indexOf(t) === -1) {
          ok = false;
          break;
        }
      }
      if (ok) {
        out.push(x.item);
        if (out.length >= 50) break;
      }
    }
    return out;
  }, [q, index]);

  useEffect(() => {
    setActive(0);
  }, [q, open]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
        setDupWarn("");
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>('[data-active="true"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [active, open, resultados.length]);

  function abrir() {
    setOpen(true);
    setDupWarn("");
    setQ("");
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function elegir(item: ItemOpt) {
    if (existingIds.includes(item.id) && item.id !== value) {
      setDupWarn("Este ingrediente ya hace parte de la receta.");
      return;
    }
    onSelect(item);
    setOpen(false);
    setQ("");
    setDupWarn("");
    if (onCommit) setTimeout(() => onCommit(), 0);
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, resultados.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (resultados[active]) elegir(resultados[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setDupWarn("");
    }
  }

  return (
    <div ref={boxRef} className="relative w-full min-w-[200px]">
      {open ? (
        <input
          ref={inputRef}
          type="text"
          value={q}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
          className="w-full rounded-md border border-[#93C5FD] px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#DBEAFE]"
        />
      ) : (
        <button
          type="button"
          onClick={abrir}
          className={
            "flex w-full items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5 text-left text-sm hover:border-[#93C5FD] focus:border-[#93C5FD] focus:outline-none " +
            (seleccionado ? "text-ink" : "text-slate-400")
          }
        >
          <span className="truncate">
            {seleccionado ? seleccionado.articulo : "Selecciona insumo o subreceta…"}
          </span>
          <span className="shrink-0 text-slate-400">▾</span>
        </button>
      )}

      {dupWarn ? (
        <div className="absolute z-[999] mt-1 w-full rounded-md border border-red-300 bg-red-50 px-2 py-1.5 text-xs text-red-700 shadow">
          {dupWarn}
        </div>
      ) : null}

      {open && !dupWarn ? (
        <div className="absolute z-[999] mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
          <div className="border-b border-slate-100 bg-[#F8FAFC] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {resultados.length} resultado{resultados.length === 1 ? "" : "s"} · ↑↓ para navegar · Enter para elegir
          </div>
          <div ref={listRef} className="max-h-72 overflow-y-auto py-1">
            {resultados.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-slate-400">
                Sin resultados para &quot;{q}&quot;
              </div>
            ) : (
              resultados.map((item, idx) => {
                const dup = existingIds.includes(item.id) && item.id !== value;
                return (
                  <div
                    key={item.id}
                    data-active={idx === active}
                    onMouseEnter={() => setActive(idx)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      elegir(item);
                    }}
                    className={
                      "flex cursor-pointer items-center justify-between gap-3 border-l-2 px-3 py-2 transition-colors " +
                      (idx === active ? "border-[#1E3A5F] bg-[#EFF6FF]" : "border-transparent hover:bg-slate-50") +
                      (dup ? " opacity-45" : "")
                    }
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{item.articulo}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500">
                        {item.tipo_item === "subreceta" && (
                          <span className="chip chip-warning !px-1.5 !py-0.5 !text-[9px]">subreceta</span>
                        )}
                        {item.referencia && (
                          <span className="rounded bg-slate-100 px-1.5 py-px font-mono text-[10px] text-slate-500">
                            {item.referencia}
                          </span>
                        )}
                        {item.subfamilia && <span>{item.subfamilia}</span>}
                        {dup && <span className="font-medium text-amber-600">· ya en la receta</span>}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono text-sm font-semibold text-[#1E3A5F]">{money(item.coste)}</div>
                      <div className="text-[10px] uppercase text-slate-400">por {item.unidad || "unidad"}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
