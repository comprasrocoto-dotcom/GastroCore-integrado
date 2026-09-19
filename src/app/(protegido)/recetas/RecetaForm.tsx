"use client";

import { useMemo, useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { crearRecetaCompleta, type EstadoReceta } from "./actions";
import { calcularResumenCosteo, precioSugerido, FC_OBJ } from "@/lib/costeo";
import { CampoNumero } from "@/components/CampoNumero";
import SearchableSelect from "@/components/SearchableSelect";
import InsumoAutocomplete, { type ItemOpt } from "@/components/InsumoAutocomplete";

type Linea = {
  itemId: string;
  tipoItem: "insumo" | "subreceta";
  unidad: string;
  cantidad: number;
  mermaPct: number; // porcentaje (0-100), como en la UI
};

const money = (n: number) =>
  "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
const pct = (n: number) => (n || 0).toFixed(2) + "%";
const num = (n: number) => (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 2 });

function BotonGuardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-50">
      {pending ? "Guardando…" : "Guardar receta"}
    </button>
  );
}

export default function RecetaForm({
  sedeId,
  familias,
  items,
  unidades,
}: {
  sedeId: string;
  familias: { id: string; nombre: string }[];
  items: ItemOpt[];
  unidades: { codigo: string; nombre: string }[];
}) {
  const [estado, formAction] = useFormState<EstadoReceta, FormData>(crearRecetaCompleta, {
    error: null,
  });

  const [nombre, setNombre] = useState("");
  const [rendimiento, setRendimiento] = useState(1);
  const [unidadRendimiento, setUnidadRendimiento] = useState("UND");
  const [desvioPct, setDesvioPct] = useState(0);
  const [familiaId, setFamiliaId] = useState("");
  const [precioReal, setPrecioReal] = useState(0);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [errores, setErrores] = useState<string[]>([]);
  const cantRefs = useRef<Record<number, HTMLInputElement | null>>({});

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
    const costoPorcion = costoFinal / (rendimiento || 1);
    const sugerido = precioSugerido(costoPorcion);
    const resumen = precioReal > 0 ? calcularResumenCosteo(costoPorcion, precioReal) : null;
    return { costoIngredientes, desvio, costoFinal, costoPorcion, sugerido, resumen };
  }, [filas, desvioPct, rendimiento, precioReal]);

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

  function validar(): string[] {
    const e: string[] = [];
    if (nombre.trim() === "") e.push("El nombre de la receta es obligatorio.");
    if (!rendimiento || rendimiento < 1) e.push("El rendimiento debe ser al menos 1 porción.");
    if (!familiaId) e.push("Elegí la familia (categoría de la carta).");
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

  return (
    <form action={formAction} onSubmit={alEnviar} className="flex flex-col gap-4">
      <input type="hidden" name="sede_id" value={sedeId} />
      <input type="hidden" name="nombre" value={nombre} />
      <input type="hidden" name="rendimiento" value={rendimiento} />
      <input type="hidden" name="unidad_rendimiento_codigo" value={unidadRendimiento} />
      <input type="hidden" name="desvio_pct" value={desvioPct} />
      <input type="hidden" name="familia_id" value={familiaId} />
      <input type="hidden" name="precio_real" value={precioReal} />
      <input type="hidden" name="ingredientes_json" value={ingredientesJson} />

      <div className="card p-4">
        <p className="mb-3 flex items-center gap-2 border-b pb-2 text-[11px] font-bold uppercase tracking-widest text-slate-500" style={{ borderColor: "var(--line)" }}>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">1</span>
          📘 Datos del plato
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
            <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Rendimiento (porciones)</span>
            <CampoNumero
              valor={rendimiento}
              onCambio={setRendimiento}
              decimales={0}
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

      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1E3A5F] text-[10px] font-bold text-white">2</span>
            🏷️ Clasificación
          </h2>
          <Link href="/familias" className="text-xs font-medium text-[#1E3A5F] hover:underline">
            Administrar familias
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Familia (categoría de la carta)</span>
            <SearchableSelect
              value={familiaId}
              onChange={setFamiliaId}
              options={familias.map((f) => ({ value: f.id, label: f.nombre }))}
              placeholder="Elige la familia…"
              searchPlaceholder="Buscar familia…"
              clearLabel="Sin clasificar"
            />
          </label>
        </div>
        {familias.length === 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Aún no hay familias de platos de venta.{" "}
            <Link href="/familias" className="text-[#1E3A5F] hover:underline">
              Creá la primera acá
            </Link>
            .
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <section className="card">
          <div className="flex items-center justify-between rounded-t-xl border-b px-5 py-3.5" style={{ borderColor: "var(--line)" }}>
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
            <div className="ticket-row">
              <span>Costo final</span>
              <span>{money(costeo.costoFinal)}</span>
            </div>
            <div className="ticket-row">
              <span>Costo del plato por porción</span>
              <span>{money(costeo.costoPorcion)}</span>
            </div>
            <div className="ticket-row">
              <span>Food cost objetivo</span>
              <span>{pct(FC_OBJ * 100)}</span>
            </div>
            <div className="my-1 border-t border-dashed" style={{ borderColor: "var(--line)" }} />
            <div className="ticket-row font-semibold text-[#1E3A5F]">
              <span>Precio sugerido de venta (con INC)</span>
              <span>{money(costeo.sugerido)}</span>
            </div>
            <div className="my-1 border-t border-dashed" style={{ borderColor: "var(--line)" }} />
            <div className="ticket-row">
              <span>Precio real de venta</span>
              <span>{money(precioReal)}</span>
            </div>
            {costeo.resumen && (
              <>
                <div className="ticket-row">
                  <span>Utilidad</span>
                  <span>{money(costeo.resumen.utilidad)}</span>
                </div>
                <div className="ticket-row">
                  <span>Margen bruto</span>
                  <span>{pct(costeo.resumen.margenBruto * 100)}</span>
                </div>
                <div className="ticket-total">
                  <span>Food cost real</span>
                  <span
                    className={`chip ${
                      costeo.resumen.semaforo === "verde"
                        ? "chip-success"
                        : costeo.resumen.semaforo === "amarillo"
                        ? "chip-warning"
                        : "chip-danger"
                    }`}
                  >
                    {pct(costeo.resumen.foodCost * 100)}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="card space-y-3 p-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Precio real de venta</span>
              <CampoNumero
                valor={precioReal}
                onCambio={setPrecioReal}
                decimales={0}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
              />
            </label>
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
