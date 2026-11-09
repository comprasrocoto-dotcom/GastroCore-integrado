"use client";

import { useMemo, useState } from "react";
import type { RecetarioItem, RecetarioDetalle } from "@/lib/data/recetario";
import { cargarDetalleRecetario } from "./actions";
import { colorCategoria, type TemaRecetario } from "@/lib/temas-recetario";

function norm(s: string): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

type Seccion = "todas" | "subrecetas-cocina" | "subrecetas-bar" | { familia: string };

/**
 * Si el Centro de Costo de la subreceta no está cargado (null/"") o está
 * marcado "AMBAS", se la considera visible desde las dos áreas — mismo
 * criterio que ya usa `recetario/page.tsx` para decidir quién puede ver
 * qué antes de que los items lleguen acá (09/11, pedido de Mariluz: separar
 * la pestaña única "Sub. recetas" en "Sub recetas cocina" / "Sub recetas
 * bar", igual que se veían en el sistema viejo).
 */
function perteneceAArea(centrocosto: string | null, area: "COCINA" | "BAR"): boolean {
  const c = (centrocosto ?? "").toUpperCase();
  return !c || c === "AMBAS" || c === area;
}

export default function RecetarioExplorador({
  items,
  tema,
}: {
  items: RecetarioItem[];
  tema: TemaRecetario;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [seccion, setSeccion] = useState<Seccion>("todas");
  const [detalle, setDetalle] = useState<RecetarioDetalle | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  const categorias = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of items) {
      if (item.tipo !== "receta") continue;
      const nombre = item.familia_nombre ?? "Sin categoría";
      mapa.set(nombre, (mapa.get(nombre) ?? 0) + 1);
    }
    return Array.from(mapa.entries()).sort((a, b) => a[0].localeCompare(b[0], "es"));
  }, [items]);

  const totalSubrecetasCocina = items.filter(
    (i) => i.tipo === "subreceta" && perteneceAArea(i.centrocosto, "COCINA")
  ).length;
  const totalSubrecetasBar = items.filter(
    (i) => i.tipo === "subreceta" && perteneceAArea(i.centrocosto, "BAR")
  ).length;

  // Color por tarjeta (06/11, a pedido de Mariluz: "que se vean llamativas
  // no tan planas"). Cada familia usa el mismo color que ya tiene su
  // pestaña arriba (colorCategoria, por índice en `categorias`); las
  // subrecetas usan el acento del tema. No es un color por marca todavía
  // (eso depende de la paleta real que Mariluz va a mandar) — por ahora es
  // el mismo tema de color que ya elige cada sede en Configuración.
  const familiaColorMap = useMemo(() => {
    const mapa = new Map<string, string>();
    categorias.forEach(([nombre], indice) => mapa.set(nombre, colorCategoria(tema, indice)));
    return mapa;
  }, [categorias, tema]);

  function colorDeItem(esSubreceta: boolean, familiaNombre?: string | null): string {
    if (esSubreceta) return tema.acento;
    return familiaColorMap.get(familiaNombre ?? "Sin categoría") ?? tema.acento;
  }

  const filtrados = useMemo(() => {
    let lista = items;
    if (seccion === "subrecetas-cocina") {
      lista = lista.filter((i) => i.tipo === "subreceta" && perteneceAArea(i.centrocosto, "COCINA"));
    } else if (seccion === "subrecetas-bar") {
      lista = lista.filter((i) => i.tipo === "subreceta" && perteneceAArea(i.centrocosto, "BAR"));
    } else if (seccion !== "todas") {
      lista = lista.filter((i) => i.tipo === "receta" && (i.familia_nombre ?? "Sin categoría") === seccion.familia);
    }
    const q = norm(busqueda);
    if (q) {
      lista = lista.filter((i) => norm(i.nombre).includes(q) || norm(i.familia_nombre ?? "").includes(q));
    }
    return lista;
  }, [items, seccion, busqueda]);

  async function abrirDetalle(item: RecetarioItem) {
    setCargando(item.id);
    try {
      const data = await cargarDetalleRecetario(item.tipo, item.id);
      setDetalle(data);
    } finally {
      setCargando(null);
    }
  }

  const botonPestañaEstilo = (activa: boolean): React.CSSProperties =>
    activa ? { background: tema.acento, color: tema.bannerTexto, borderColor: tema.acento } : {};
  const botonPestañaClase = (activa: boolean) =>
    `flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
      activa ? "" : "border-slate-200 text-slate-600 hover:bg-slate-100"
    }`;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex items-center justify-between rounded-xl px-4 py-3"
        style={{
          background: `linear-gradient(90deg, ${tema.bannerDesde}, ${tema.bannerHasta})`,
          color: tema.bannerTexto,
        }}
      >
        <span className="text-sm font-semibold">Recetario</span>
        <span className="text-xs opacity-80">{items.length} preparaciones</span>
      </div>

      {/* Pestañas horizontales por sección/familia (antes era una lista
          vertical a la izquierda — se pasó a pestañas arriba a pedido de
          Mariluz, 01/11, ver docs/arquitectura.md). Con scroll horizontal
          si no entran todas en el ancho disponible. */}
      <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1">
        <button
          className={botonPestañaClase(seccion === "todas")}
          style={botonPestañaEstilo(seccion === "todas")}
          onClick={() => setSeccion("todas")}
        >
          Todas
          <span className="text-xs opacity-70">{items.length}</span>
        </button>
        {totalSubrecetasCocina > 0 && (
          <button
            className={botonPestañaClase(seccion === "subrecetas-cocina")}
            style={botonPestañaEstilo(seccion === "subrecetas-cocina")}
            onClick={() => setSeccion("subrecetas-cocina")}
          >
            Sub. recetas cocina
            <span className="text-xs opacity-70">{totalSubrecetasCocina}</span>
          </button>
        )}
        {totalSubrecetasBar > 0 && (
          <button
            className={botonPestañaClase(seccion === "subrecetas-bar")}
            style={botonPestañaEstilo(seccion === "subrecetas-bar")}
            onClick={() => setSeccion("subrecetas-bar")}
          >
            Sub. recetas bar
            <span className="text-xs opacity-70">{totalSubrecetasBar}</span>
          </button>
        )}
        {categorias.map(([nombre, cantidad], indice) => {
          const activa = typeof seccion === "object" && seccion.familia === nombre;
          return (
            <button
              key={nombre}
              className={botonPestañaClase(activa)}
              style={botonPestañaEstilo(activa)}
              onClick={() => setSeccion({ familia: nombre })}
            >
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: activa ? tema.bannerTexto : colorCategoria(tema, indice) }}
              />
              {nombre}
              <span className="text-xs opacity-70">{cantidad}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-4">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar receta o ingrediente..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E3A5F]"
        />

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {filtrados.map((item) => {
            const color = colorDeItem(item.tipo === "subreceta", item.familia_nombre);
            return (
              <button
                key={`${item.tipo}-${item.id}`}
                onClick={() => abrirDetalle(item)}
                className="card card-hover flex flex-col items-start gap-0 overflow-hidden p-0 text-left"
              >
                <div className="h-1.5 w-full shrink-0" style={{ background: color }} />
                {item.foto_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.foto_url} alt="" className="h-28 w-full object-cover" />
                ) : (
                  <div
                    className="flex h-28 w-full items-center justify-center text-3xl"
                    style={{ background: `linear-gradient(135deg, ${color}2e, ${color}10)` }}
                  >
                    {item.tipo === "subreceta" ? "🧪" : "🍽️"}
                  </div>
                )}
                <div className="flex flex-col gap-1.5 p-3">
                  <p
                    className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ background: `${color}1f`, color }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                    {item.tipo === "subreceta" ? "Sub. receta" : item.familia_nombre ?? "Sin categoría"}
                  </p>
                  <p className="text-sm font-semibold leading-snug">{item.nombre}</p>
                  <p className="text-xs text-slate-400">
                    {item.ingredientes_count} ingrediente{item.ingredientes_count === 1 ? "" : "s"}
                    {cargando === item.id ? " · abriendo..." : ""}
                  </p>
                </div>
              </button>
            );
          })}
          {filtrados.length === 0 && (
            <p className="col-span-full py-8 text-center text-slate-400">
              No se encontraron recetas.
            </p>
          )}
        </div>
      </div>

      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDetalle(null)}
        >
          <div
            className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto p-0"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-1.5 w-full shrink-0"
              style={{ background: colorDeItem(detalle.tipo === "subreceta", detalle.familia_nombre) }}
            />
            {detalle.foto_url && (
              <div className="relative h-64 w-full bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={detalle.foto_url} alt="" className="h-64 w-full object-contain" />
                <button
                  type="button"
                  onClick={() => setFotoAmpliada(detalle.foto_url)}
                  className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Ver foto en grande"
                  title="Ver foto en grande"
                >
                  🔍
                </button>
              </div>
            )}
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">
                    {detalle.tipo === "subreceta" ? "Sub. receta" : detalle.familia_nombre ?? "Recetario"}
                  </p>
                  <h2 className="text-lg font-semibold">{detalle.nombre}</h2>
                </div>
                <button
                  onClick={() => setDetalle(null)}
                  className="rounded-full px-2 py-1 text-slate-400 hover:bg-slate-100"
                  aria-label="Cerrar"
                >
                  ✕
                </button>
              </div>

              {detalle.rendimiento && (
                <div className="rounded-lg border border-slate-200 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Rendimiento producido
                  </p>
                  <p className="mt-1 text-2xl font-bold">
                    {detalle.rendimiento} {detalle.unidad_rendimiento_codigo ?? ""}
                  </p>
                  <p className="text-xs text-slate-400">Esta preparación rinde por tanda.</p>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                  Ingredientes
                </p>
                {detalle.ingredientes.length === 0 ? (
                  <p className="text-sm text-slate-400">Sin ingredientes cargados.</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-slate-400">
                        <th className="pb-1 font-medium">Artículo</th>
                        <th className="pb-1 text-right font-medium">Unidad</th>
                        <th className="pb-1 text-right font-medium">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detalle.ingredientes.map((i, idx) => (
                        <tr key={idx} className="border-t border-slate-100">
                          <td className="py-1.5">{i.descripcion}</td>
                          <td className="py-1.5 text-right text-slate-500">{i.unidad_codigo ?? "—"}</td>
                          <td className="py-1.5 text-right font-mono">{i.cantidad}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {detalle.preparacion && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Preparación
                  </p>
                  <p className="whitespace-pre-line text-sm text-slate-700">{detalle.preparacion}</p>
                </div>
              )}
              {detalle.emplatado && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Emplatado
                  </p>
                  <p className="whitespace-pre-line text-sm text-slate-700">{detalle.emplatado}</p>
                </div>
              )}
              {detalle.notas && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Notas
                  </p>
                  <p className="whitespace-pre-line text-sm text-slate-700">{detalle.notas}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={fotoAmpliada}
            alt=""
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
          />
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
