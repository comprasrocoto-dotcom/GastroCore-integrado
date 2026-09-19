"use client";

import { useFormState, useFormStatus } from "react-dom";
import { crearSubreceta, type EstadoSubreceta } from "./actions";

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary self-start">
      {pending ? "Creando…" : "Crear subreceta"}
    </button>
  );
}

export default function SubrecetaForm({ sedeId }: { sedeId: string }) {
  const [estado, formAction] = useFormState<EstadoSubreceta, FormData>(crearSubreceta, {
    error: null,
  });

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-5">
      <input type="hidden" name="sede_id" value={sedeId} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Nombre *</label>
        <input
          name="nombre"
          required
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Rendimiento</label>
          <input
            name="rendimiento"
            type="number"
            step="0.01"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Unidad</label>
          <input
            name="unidad_rendimiento_codigo"
            placeholder="GR, KG, UND…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          />
        </div>
      </div>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {estado.error}
        </p>
      )}

      <BotonCrear />
    </form>
  );
}
