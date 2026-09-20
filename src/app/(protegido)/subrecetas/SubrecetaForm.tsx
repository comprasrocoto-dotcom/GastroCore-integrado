"use client";

import { useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearSubrecetaCompleta, type EstadoSubreceta } from "./actions";
import { CampoNumero } from "@/components/CampoNumero";
import InsumoAutocomplete, { type ItemOpt } from "@/components/InsumoAutocomplete";
import type { InsumoSubSinVincular } from "@/lib/data/subrecetas";

type Linea = {
  itemId: string;
  tipoItem: "insumo" | "subreceta";
  unidad: string;
  cantidad: number;
  mermaPct: number; // porcentaje (0-100), como en la UI
};

function norm(s: string): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

const money = (n: number) =>
  "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const num = (n: number) => (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-50">
      {pending ? "Guardando…" : "Guardar receta"}
    </button>
  );
}

export default function SubrecetaForm({
  sedeId,
  insumosSubSinVincular,
  referenciaSugerida,
  subfamilias,
  items,
  unidades,
}: {
  sedeId: string;
  insumosSubSinVincular: InsumoSubSinVincular[];
  referenciaSugerida: string;
  subfamilias: { id: string; nombre: string; familia_nombre: string }[];
  items: ItemOpt[];
  unidades: { codigo: string; nombre: string }[];
}) {
  const [estado, formAction] = useFormState<EstadoSubreceta, FormData>(crearSubrecetaCompleta, {
    error: null,
  });

  // Card 1 — Maestro en Insumos: o se enlaza uno "SUB." existente sin usar,
  // o se completan los datos para crear uno nuevo (mutuamente excluyentes).
  const [busqueda, setBusqueda] = useState("");
  const [insumoVinculadoId, setInsumoVinculadoId] = useState("");
  const [referencia, setReferencia] = useState(referenciaSugerida);
  const [subfamiliaId, setSubfamiliaId] = useState("");

  // Card 2 — Datos de la preparación
  const [nombre, setNombre] = useState("");
  const [rendimiento, setRendimiento] = useState(1);
  const [unidadRendimiento, setUnidadRendimiento] = useState(unidades[0]?.codigo ?? "");
  const [desvioPct, setDesvioPct] = useState(0);

  const [lineas, setLineas] = useState<Linea[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const cantRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const resultadosBusqueda = useMemo(() => {
    const q = norm(busqueda);
    if (!q) return [];
    return insumosSubSinVincular
      .filter((i) => norm(i.articulo).includes(q) || norm(i.referencia ?? "").includes(q))
      .slice(0, 20);
  }, [busqueda, insumosSubSinVincular]);

  const insumoVinculado = useMemo(
    () => insumosSubSinVincular.find((i) => i.id === insumoVinculadoId) || null,
    [insumosSubSinVincular, insumoVinculadoId]
  );

  const itemPorId = useMemo(() => {
    const m: Record<string, ItemOpt> = {};
    items.forEach((i) => (m[i.id] = i));
    return m;
  }, [items]);

  const filas = useMemo(() => {
    return lineas.map((l) => {
      const item = itemPorId[l.itemId];
      const costoUnit = item ? Number(item.coste) : 0;
      const mermaPct = Math.min(Math.max(Number(l.mermaPct) || 0, 0), 94.9);
      const cantReal = (Number(l.cantidad) || 0) / (1 - mermaPct / 100);
      const costoTotal = costoUnit * cantReal;
      return { item, costoUnit, cantReal, costoTotal };
    });
  }, [lineas, itemPorId]);

  const costeo = useMemo(() => {
    const costoIngredientes = filas.reduce((s, f) => s + f.costoTotal, 0);
    const desvio = costoIngredientes * (desvioPct / 100);
    const costoFinal = costoIngredientes + desvio;
    const costoUnitario = costoFinal / (rendimiento || 1);
    return { costoIngredientes, desvio, costoFinal, costoUnitario };
  }, [filas, desvioPct, rendimiento]);

  const addLinea = () =>
    setLineas((p) => [...p, { itemId: "", tipoItem: "insumo", unidad: "", cantidad: 1, mermaPct: 0 }]);
  const updLinea = (i: number, patch: Partial<Linea>) =>
    setLineas((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  const delLinea = (i: number) => setLineas((p) => p.filter((_, idx) => idx !== i));

  const onElegirItem = (i: number, item: ItemOpt) => {
    updLinea(i, {
      itemId: item.id,
      tipoItem: item.tipo_item,
      unidad: item.unidad ?? "",
      mermaPct: Number(item.merma_std ?? 0),
    });
  };

  function elegirVinculo(id: string) {
    setInsumoVinculadoId(id);
    setBusqueda("");
  }

  function quitarVinculo() {
    setInsumoVinculadoId("");
    setBusqueda("");
  }

  function validar(): string[] {
    const e: string[] = [];
    if (nombre.trim() === "") e.push("El nombre de la receta es obligatorio.");
    if (!rendimiento || rendimiento <= 0) e.push("El rendimiento producido debe ser mayor a 0.");
    if (!insumoVinculadoId && !referencia.trim())
      e.push('Elegí un insumo "SUB." existente o escribí una referencia para el maestro nuevo.');
    if (lineas.length === 0) e.push("Agregá al menos un ingrediente.");
    lineas.forEach((l, idx) => {
      const n = idx + 1;
      if (!l.itemId) e.push(`Ingrediente ${n}: seleccioná un insumo o subreceta.`);
      if (!l.cantidad || Number(l.cantidad) <= 0) e.push(`Ingrediente ${n}: la cantidad debe ser mayor a 0.`);
    });
    return e;
  }

  function alEnviar(e: React.FormEvent<HTMLFormElement>) {
    const e2 = validar();
    setErrores(e2);
    if (e2.length > 0) {
      e.preventDefault();
    }
  }

  const ingredientesJson = JSON.stringify(
    lineas.map((l) => ({
      tipoItem: l.tipoItem,
      itemId: l.itemId,
      cantidad: Number(l.cantidad),
      unidadCodigo: l.unidad || null,
      mermaPct: (Number(l.mermaPct) || 0) / 100,
    }))
  );

  const modo = insumoVinculadoId ? "vincular" : "crear";

  return (
    <form action={formAction} onSubmit={alEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="sede_id" value={sedeId} />
      <input type="hidden" name="nombre" value={nombre} />
      <input type="hidden" name="rendimiento" value={rendimiento} />
      <input type="hidden" name="unidad_rendimiento_codigo" value={unidadRendimiento} />
      <input type="hidden" name="desvio_pct" value={desvioPct} />
      <input type="hidden" name="modo" value={modo} />
      <input type="hidden" name="insumo_vinculado_id" value={insumoVinculadoId} />
      <input type="hidden" name="referencia" value={referencia} />
      <input type="hidden" name="subfamilia_id" value={subfamiliaId} />
      <input type="hidden" name="ingredientes_json" value={ingredientesJson} />

      <div className="card p-4">
        <p
          className="mb-3 flex items-center gap-2 border-b pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">
            1
          </span>
          🔗 Maestro en Insumos
        </p>
        <p className="mb-3 text-xs text-slate-500">
          Toda preparación vive en INSUMOS (es lo que las recetas usan). Enlazá un insumo &quot;SUB.&quot;
          existente, o creá el maestro nuevo con su referencia y subfamilia.
        </p>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Buscar en insumos — la preparación ya existe como &quot;SUB.&quot;
            </p>
            {insumoVinculado ? (
              <div className="flex items-center justify-between rounded-md bg-[#EFF6FF] px-3 py-2 text-sm">
                <span>
                  {insumoVinculado.articulo}{" "}
                  {insumoVinculado.referencia && (
                    <span className="ml-1 rounded bg-white px-1.5 py-px font-mono text-[10px] text-slate-500">
                      {insumoVinculado.referencia}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={quitarVinculo}
                  className="text-slate-400 hover:text-red-600"
                  title="Quitar enlace"
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o referencia… (ej: fondo, SUB-ARROZ)"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
                />
                {busqueda ? (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-slate-100">
                    {resultadosBusqueda.length === 0 ? (
                      <p className="px-3 py-3 text-center text-xs text-slate-400">
                        No hay preparaciones &quot;SUB.&quot; sin enlazar que coincidan.
                      </p>
                    ) : (
                      resultadosBusqueda.map((i) => (
                        <button
                          type="button"
                          key={i.id}
                          onClick={() => elegirVinculo(i.id)}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                        >
                          {i.articulo}{" "}
                          {i.referencia && (
                            <span className="ml-1 rounded bg-slate-100 px-1.5 py-px font-mono text-[10px] text-slate-500">
                              {i.referencia}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    {insumosSubSinVincular.length === 0
                      ? 'No hay preparaciones "SUB." sin enlazar todavía.'
                      : "Escribí para buscar entre las preparaciones sin enlazar."}
                  </p>
                )}
              </>
            )}
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              + Crear maestro nuevo — la preparación NO existe aún en Insumos
            </p>
            <label className="mb-2 block">
              <span className="text-xs font-medium text-slate-600">Referencia del maestro (código único)</span>
              <input
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                disabled={!!insumoVinculadoId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] disabled:bg-slate-100 disabled:text-slate-400"
              />
              <span className="mt-1 block text-[11px] text-emerald-700">
                ✓ Siguiente disponible: {referenciaSugerida} (editable)
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600">Subfamilia del maestro</span>
              <select
                value={subfamiliaId}
                onChange={(e) => setSubfamiliaId(e.target.value)}
                disabled={!!insumoVinculadoId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F] disabled:bg-slate-100 disabled:text-slate-400"
              >
                <option value="">Elegí la subfamilia…</option>
                {subfamilias.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.familia_nombre ? `${s.familia_nombre} · ${s.nombre}` : s.nombre}
                  </option>
                ))}
              </select>
            </label>
            <p className="mt-2 text-[11px] text-slate-500">
              Al guardar, el insumo nace en Insumos con el NOMBRE tal cual lo escribís abajo (usá el prefijo
              SUB. si querés que se agrupe como preparación), esta referencia y el costo calculado.
            </p>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <p
          className="mb-3 flex items-center gap-2 border-b pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500"
          style={{ borderColor: "var(--line)" }}
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">
            2
          </span>
          📋 Datos de la preparación
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block sm:col-span-2">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Nombre de la receta</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Ceviche clásico"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Rendimiento producido</span>
            <CampoNumero
              valor={rendimiento}
              onCambio={setRendimiento}
              decimales={2}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Unidad de rendimiento</span>
            <select
              value={unidadRendimiento}
              onChange={(e) => setUnidadRendimiento(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            >
              {unidades.map((u) => (
                <option key={u.codigo} value={u.codigo}>
                  {u.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Desvío mercancía (%)</span>
            <CampoNumero
              valor={desvioPct}
              onCambio={setDesvioPct}
              decimales={1}
              sufijo="%"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
            />
          </label>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card">
          <div
            className="flex items-center justify-between rounded-t-xl border-b px-5 py-3.5"
            style={{ borderColor: "var(--line)" }}
          >
            <h2 className="font-display text-base font-semibold">Ingredientes ({lineas.length})</h2>
            <button type="button" onClick={addLinea} className="btn-primary text-xs">
              + Agregar ingrediente
            </button>
          </div>
          <div className="erp-scroll">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Insumo</th>
                  <th>Unidad</th>
                  <th className="text-right">Cantidad</th>
                  <th className="text-right">% Merma</th>
                  <th className="text-right">Cant. real</th>
                  <th className="text-right">C. unitario</th>
                  <th className="text-right">C. total</th>
                  <th className="text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td>
                      <InsumoAutocomplete
                        value={l.itemId}
                        items={items}
                        existingIds={lineas.filter((_, idx) => idx !== i).map((x) => x.itemId).filter(Boolean)}
                        onSelect={(item) => onElegirItem(i, item)}
                        onCommit={() => cantRefs.current[i]?.focus()}
                      />
                    </td>
                    <td>
                      <span className="inline-block min-w-[56px] rounded-md bg-slate-50 px-2 py-1.5 text-center text-sm text-slate-600">
                        {l.unidad || "—"}
                      </span>
                    </td>
                    <td className="text-right">
                      <CampoNumero
                        valor={l.cantidad}
                        onCambio={(n) => updLinea(i, { cantidad: n })}
                        decimales={2}
                        inputRef={(el) => {
                          cantRefs.current[i] = el;
                        }}
                        className="w-20 rounded-md border border-slate-200 px-1.5 py-1.5 text-right text-sm outline-none focus:border-[#1E3A5F]"
                      />
                    </td>
                    <td className="text-right">
                      <CampoNumero
                        valor={l.mermaPct}
                        onCambio={(n) => updLinea(i, { mermaPct: n })}
                        decimales={1}
                        sufijo="%"
                        className="w-16 rounded-md border border-slate-200 px-1.5 py-1.5 text-right text-sm outline-none focus:border-[#1E3A5F]"
                      />
                    </td>
                    <td className="whitespace-nowrap text-right font-mono text-xs text-slate-600">
                      {num(filas[i]?.cantReal || 0)}
                    </td>
                    <td className="whitespace-nowrap text-right font-mono text-xs text-slate-600">
                      {money(filas[i]?.costoUnit || 0)}
                    </td>
                    <td className="fin-value whitespace-nowrap text-right font-mono text-xs">
                      {money(filas[i]?.costoTotal || 0)}
                    </td>
                    <td className="text-center">
                      <button type="button" onClick={() => delLinea(i)} title="Eliminar" className="text-slate-400 hover:text-red-600">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
                {lineas.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">
                      Aún no hay ingredientes. Presioná + Agregar ingrediente para comenzar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="flex flex-col gap-4 self-start">
          <div className="ticket-panel">
            <p className="mb-1 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]">
              Costo por unidad producida
            </p>
            <p className="fin-value text-center text-2xl font-bold">{money(costeo.costoUnitario)}</p>
            <p className="mb-2 text-center text-[11px] text-slate-500">
              por {unidadRendimiento || "unidad"} · rinde {num(rendimiento)} {unidadRendimiento || "unidad"}
            </p>
            <p className="text-center text-[11px] text-slate-400">
              Este valor se usará automáticamente como costo cuando esta subreceta se agregue a otras recetas.
            </p>
          </div>

          <div className="ticket-panel">
            <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[#1E3A5F]">
              Resumen de costeo
            </p>
            <div className="ticket-row">
              <span>Costo ingredientes</span>
              <span>{money(costeo.costoIngredientes)}</span>
            </div>
            <div className="ticket-row">
              <span>Desvío mercancía</span>
              <span>{money(costeo.desvio)}</span>
            </div>
            <div className="ticket-total">
              <span>Costo final</span>
              <span>{money(costeo.costoFinal)}</span>
            </div>
          </div>

          {errores.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <p className="mb-1 font-semibold">Corregí lo siguiente:</p>
              <ul className="list-disc space-y-0.5 pl-4">
                {errores.map((er, k) => (
                  <li key={k}>{er}</li>
                ))}
              </ul>
            </div>
          )}
          {estado.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {estado.error}
            </p>
          )}

          <BotonGuardar />
        </aside>
      </div>
    </form>
  );
}
