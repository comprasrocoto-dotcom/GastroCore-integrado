"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verificarClaveRecetario } from "./actions";

/**
 * Pantalla previa al Recetario cuando la sede tiene clave de Bar y/o
 * Cocina cargada en Configuración — elegís tu área, ponés la clave, y el
 * Recetario de ese dispositivo queda filtrado a esa área (la cookie dura
 * 12 horas, un turno de trabajo).
 */
export default function RecetarioClaveGate({
  sedeId,
  tieneBar,
  tieneCocina,
}: {
  sedeId: string;
  tieneBar: boolean;
  tieneCocina: boolean;
}) {
  const [area, setArea] = useState<"BAR" | "COCINA" | null>(
    tieneBar && !tieneCocina ? "BAR" : !tieneBar && tieneCocina ? "COCINA" : null
  );
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!area) {
      setError("Elegí tu área.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const resultado = await verificarClaveRecetario(sedeId, area, clave);
      if (!resultado.ok) {
        setError(resultado.error ?? "No se pudo verificar la clave.");
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <form
        onSubmit={enviar}
        className="card flex w-full max-w-sm flex-col gap-4 p-5"
      >
        <div>
          <h1 className="text-lg font-semibold">Recetario</h1>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Elegí tu área e ingresá la clave para ver el recetario.
          </p>
        </div>

        <div className="flex gap-2">
          {tieneBar && (
            <button
              type="button"
              onClick={() => setArea("BAR")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                area === "BAR" ? "border-[#1E3A5F] bg-[#1E3A5F] text-white" : "border-slate-300"
              }`}
            >
              Bar
            </button>
          )}
          {tieneCocina && (
            <button
              type="button"
              onClick={() => setArea("COCINA")}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                area === "COCINA" ? "border-[#1E3A5F] bg-[#1E3A5F] text-white" : "border-slate-300"
              }`}
            >
              Cocina
            </button>
          )}
        </div>

        <input
          type="password"
          inputMode="numeric"
          value={clave}
          onChange={(e) => setClave(e.target.value)}
          placeholder="Clave"
          autoFocus
          className="rounded-lg border border-slate-300 px-3 py-2 text-center text-lg tracking-widest outline-none focus:border-[#1E3A5F]"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-50">
          {pending ? "Verificando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
