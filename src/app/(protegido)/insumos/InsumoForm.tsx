"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { EstadoInsumo } from "./actions";

type Opcion = { id: string; etiqueta: string };

function BotonGuardar({ texto }: { texto: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary self-start">
      {pending ? "Guardando…" : texto}
    </button>
  );
}

export default function InsumoForm({
  accion,
  valoresIniciales,
  subfamilias,
  unidades,
  sedeId,
  esEdicion,
}: {
  accion: (estado: EstadoInsumo, formData: FormData) => Promise<EstadoInsumo>;
  valoresIniciales?: {
    id?: string;
    referencia?: string | null;
    articulo?: string;
    subarticulo?: string | null;
    subfamilia_id?: string | null;
    unidad_codigo?: string | null;
    coste?: number;
    activo?: boolean;
  };
  subfamilias: Opcion[];
  unidades: Opcion[];
  sedeId: string;
  esEdicion: boolean;
}) {
  const [estado, formAction] = useFormState(accion, { error: null });

  return (
    <form action={formAction} className="card flex max-w-xl flex-col gap-4 p-5">
      <input type="hidden" name="sede_id" value={sedeId} />
      {valoresIniciales?.id && (
        <input type="hidden" name="id" value={valoresIniciales.id} />
      )}

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Artículo *</label>
        <input
          name="articulo"
          required
          defaultValue={valoresIniciales?.articulo ?? ""}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Subartículo</label>
        <input
          name="subarticulo"
          defaultValue={valoresIniciales?.subarticulo ?? ""}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Referencia</label>
        <input
          name="referencia"
          defaultValue={valoresIniciales?.referencia ?? ""}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Subfamilia</label>
          <select
            name="subfamilia_id"
            defaultValue={valoresIniciales?.subfamilia_id ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          >
            <option value="">— Sin subfamilia —</option>
            {subfamilias.map((s) => (
              <option key={s.id} value={s.id}>
                {s.etiqueta}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Unidad</label>
          <select
            name="unidad_codigo"
            defaultValue={valoresIniciales?.unidad_codigo ?? ""}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          >
            <option value="">—</option>
            {unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.etiqueta}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Costo *</label>
        <input
          name="coste"
          type="number"
          step="0.01"
          min="0"
          required
          defaultValue={valoresIniciales?.coste ?? 0}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
        />
      </div>

      {esEdicion && (
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">
            Motivo del cambio de costo (si aplica)
          </label>
          <input
            name="motivo"
            placeholder="Ej: aumento del proveedor"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
          />
        </div>
      )}

      {esEdicion && (
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="activo"
            defaultChecked={valoresIniciales?.activo ?? true}
          />
          Activo
        </label>
      )}

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {estado.error}
        </p>
      )}

      <BotonGuardar texto={esEdicion ? "Guardar cambios" : "Crear insumo"} />
    </form>
  );
}
