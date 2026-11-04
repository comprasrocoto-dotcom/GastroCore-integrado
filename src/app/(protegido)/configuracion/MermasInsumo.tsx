"use client";

import { useState, useTransition } from "react";
import { buscarInsumosParaMerma, actualizarMermaInsumo } from "./actions";
import type { InsumoFila } from "@/lib/data/insumos";

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

/**
 * "Mermas estándar por insumo" (27/10): buscador rápido para cargar el
 * % de merma típico de un insumo (limpieza/porcionado). `insumos.merma_std`
 * ya existía y ya se usa para precargar la merma cuando se agrega ese
 * insumo en el editor de recetas/subrecetas — lo que faltaba era una
 * forma de editarlo, porque hoy no se puede cambiar desde ningún otro
 * lado de la app. No recalcula recetas ya existentes.
 */
export default function MermasInsumo({ sedeId }: { sedeId: string }) {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<InsumoFila[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [guardadoId, setGuardadoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function buscar(valor: string) {
    setQ(valor);
    if (!valor.trim()) {
      setResultados([]);
      return;
    }
    setBuscando(true);
    try {
      const items = await buscarInsumosParaMerma(sedeId, valor);
      setResultados(items);
    } finally {
      setBuscando(false);
    }
  }

  function guardarMerma(insumoId: string, valor: string) {
    const pct = Number(valor);
    if (!Number.isFinite(pct) || pct < 0 || pct >= 100) return;
    startTransition(() => {
      actualizarMermaInsumo(insumoId, pct).then(() => {
        setGuardadoId(insumoId);
        setTimeout(() => setGuardadoId((actual) => (actual === insumoId ? null : actual)), 1500);
      });
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        type="search"
        placeholder="Buscar insumo… (ej: cebolla, pescado, aguacate)"
        value={q}
        onChange={(e) => buscar(e.target.value)}
        className={inputClase}
      />
      {buscando && <span className="text-xs text-slate-400">Buscando…</span>}
      {resultados.length > 0 && (
        <div className="flex flex-col gap-2">
          {resultados.map((i) => (
            <div
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"
              style={{ borderColor: "var(--line)" }}
            >
              <span className="flex-1">{i.articulo}</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="99"
                  defaultValue={i.merma_std !== null ? (i.merma_std * 100).toFixed(2) : ""}
                  placeholder="0"
                  className={`${inputClase} w-24`}
                  onBlur={(e) => guardarMerma(i.id, e.target.value)}
                />
                <span className="text-xs" style={{ color: "var(--muted)" }}>
                  %
                </span>
                {guardadoId === i.id && (
                  <span className="text-xs text-emerald-600">Guardado</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {q.trim() && !buscando && resultados.length === 0 && (
        <span className="text-xs text-slate-400">Sin resultados.</span>
      )}
    </div>
  );
}
