"use client";

import { useState } from "react";
import { guardarEstiloRecetario } from "./actions";
import { TEMAS_RECETARIO } from "@/lib/temas-recetario";

/**
 * "Estilo del recetario" (27/10): elegir uno de los 6 estilos de color
 * para el Recetario público (banner + colores de categoría) — ya estaban
 * definidos en `lib/temas-recetario.ts` pero sin ninguna pantalla para
 * elegirlos. No cambia ningún dato ni ninguna fórmula, solo el color.
 */
export default function EstiloRecetario({
  sedeId,
  temaActualId,
}: {
  sedeId: string;
  temaActualId: string;
}) {
  const [elegido, setElegido] = useState(temaActualId);

  return (
    <form action={guardarEstiloRecetario} className="flex flex-col gap-3">
      <input type="hidden" name="sede_id" value={sedeId} />
      <input type="hidden" name="tema_id" value={elegido} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {TEMAS_RECETARIO.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setElegido(t.id)}
            className="flex flex-col gap-2 rounded-xl border p-3 text-left transition"
            style={{
              borderColor: elegido === t.id ? t.acento : "var(--line)",
              borderWidth: elegido === t.id ? 2 : 1,
            }}
          >
            <div
              className="h-8 w-full rounded-lg"
              style={{
                background: `linear-gradient(90deg, ${t.bannerDesde}, ${t.bannerHasta})`,
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{t.nombre}</span>
              {elegido === t.id && <span className="text-xs">✓</span>}
            </div>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {t.descripcion}
            </p>
            <div className="flex gap-1">
              {t.categorias.map((c) => (
                <span
                  key={c}
                  className="h-2 w-5 rounded-full"
                  style={{ background: c }}
                />
              ))}
            </div>
          </button>
        ))}
      </div>

      <button type="submit" className="btn-primary self-start" disabled={elegido === temaActualId}>
        {elegido === temaActualId ? "Estilo aplicado" : "Aplicar estilo"}
      </button>
    </form>
  );
}
