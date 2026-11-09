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

type Seccion =
  | "todas"
  | { tipo: "familia"; nombre: string }
  | { tipo: "subrecetas"; area: "COCINA" | "BAR" };

/**
 * Si el Centro de Costo de la subreceta no está cargado (null/"") o está
 * marcado "AMBAS", se la considera visible desde las dos áreas — mismo
 * criterio que ya usa `recetario/page.tsx` para decidir quién puede ver
 * qué antes de que los items lleguen acá (09/11, pedido de Mariluz: separar
 * "Sub. recetas" en Cocina/Bar, igual que se veían en el sistema viejo).
 */
function perteneceAArea(centrocosto: string | null, area: "COCINA" | "BAR"): boolean {
  const c = (centrocosto ?? "").toUpperCase();
  return !c || c === "AMBAS" || c === area;
}

const COLOR_BANNER = "#15181F";

export default function RecetarioExplorador({
  items,
  tema,
  marcaNombre,
  area,
}: {
  items: RecetarioItem[];
  tema: TemaRecetario;
  marcaNombre: string;
  area: "COCINA" | "BAR" | null;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [seccion, setSeccion] = useState<Seccion>("todas");
  const [detalle, setDetalle] = useState<RecetarioDetalle | null>(null);
  const [cargando, setCargando] = useState<string | null>(null);
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null);

  // Lista plana de familias (todas las áreas juntas) — se usa solo para
  // asignarle un color consistente a cada familia (familiaColorMap), sin
  // importar en qué grupo del menú lateral termine cayendo.
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

  /**
   * Menú lateral "SECCIONES" (09/11, a pedido de Mariluz, volviendo a una
   * lista vertical como la del sistema viejo — deshace el cambio del
   * 01/11 que había pasado esto a pestañas horizontales arriba). Las
   * familias de Recetas se agrupan por Centro de Costo (Bar/Cocina, igual
   * que ya hace `recetas/page.tsx`), y dentro de cada grupo se agrega una
   * fila más de "Sub. Recetas" con el conteo de subrecetas de esa área —
   * confirmado con Mariluz: separadas por área, no todas juntas como en
   * la foto del sistema viejo.
   */
  const gruposFamilias = useMemo(() => {
    const porCC = new Map<string, Map<string, number>>();
    const sinCC = new Map<string, number>();
    for (const item of items) {
      if (item.tipo !== "receta") continue;
      const nombre = item.familia_nombre ?? "Sin categoría";
      const cc = (item.centrocosto ?? "").toUpperCase();
      if (!cc) {
        sinCC.set(nombre, (sinCC.get(nombre) ?? 0) + 1);
      } else {
        if (!porCC.has(cc)) porCC.set(cc, new Map());
        const m = porCC.get(cc)!;
        m.set(nombre, (m.get(nombre) ?? 0) + 1);
      }
    }
    return { porCC, sinCC };
  }, [items]);

  const totalPorArea = (cc: "COCINA" | "BAR"): number => {
    const familias = gruposFamilias.porCC.get(cc);
    const sumaFamilias = familias ? Array.from(familias.values()).reduce((a, b) => a + b, 0) : 0;
    const subs = cc === "BAR" ? totalSubrecetasBar : totalSubrecetasCocina;
    return sumaFamilias + subs;
  };

  // Color por tarjeta (06/11, a pedido de Mariluz: "que se vean llamativas
  // no tan planas"). Cada familia usa el mismo color que ya tiene su fila
  // en el menú lateral (colorCategoria, por índice en `categorias`); las
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

  function esActiva(s: Seccion): boolean {
    if (s === "todas") return seccion === "todas";
    if (typeof seccion !== "object") return false;
    if (s.tipo === "subrecetas") return seccion.tipo === "subrecetas" && seccion.area === s.area;
    return seccion.tipo === "familia" && seccion.nombre === s.nombre;
  }

  const filtrados = useMemo(() => {
    let lista = items;
    if (seccion !== "todas") {
      if (seccion.tipo === "subrecetas") {
        lista = lista.filter((i) => i.tipo === "subreceta" && perteneceAArea(i.centrocosto, seccion.area));
      } else {
        lista = lista.filter((i) => i.tipo === "receta" && (i.familia_nombre ?? "Sin categoría") === seccion.nombre);
      }
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

  const filaClase = (activa: boolean) =>
    `flex items-center justify-between gap-2 truncate rounded-lg px-2 py-1.5 text-sm ${
      activa ? "font-semibold" : "text-slate-600 hover:bg-slate-50"
    }`;
  const filaEstilo = (activa: boolean): React.CSSProperties =>
    activa ? { background: `${tema.acento}1f`, color: tema.acento } : {};

  const tituloRecetario = area === "COCINA" ? "Recetario de Cocina" : area === "BAR" ? "Recetario de Bar" : "Recetario";

  // Pasos de preparación: el sistema viejo los muestra numerados (1, 2, 3…)
  // en vez de un párrafo corrido — acá se arman separando por línea
  // (09/11, confirmado con Mariluz).
  const pasosPreparacion = (detalle?.preparacion ?? "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl px-4 py-6 text-center" style={{ background: COLOR_BANNER }}>
        <p
          className="text-xs font-semibold uppercase tracking-[0.2em]"
          style={{ color: tema.acento }}
        >
          {marcaNombre}
        </p>
        <h1 className="mt-1 font-serif text-2xl text-white">{tituloRecetario}</h1>
        <p className="mt-1 text-xs text-white/60">{items.length} preparaciones</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
        <aside className="card flex flex-col gap-1 self-start p-3">
          <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Secciones
          </p>
          <button className={filaClase(esActiva("todas"))} style={filaEstilo(esActiva("todas"))} onClick={() => setSeccion("todas")}>
            <span>Todas</span>
            <span className="text-xs opacity-70">{items.length}</span>
          </button>

          {[...gruposFamilias.porCC.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([cc, familias]) => (
              <div key={cc} className="mt-1">
                <p className="flex items-center justify-between px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <span>{cc === "BAR" ? "Bar" : "Cocina"}</span>
                  <span className="text-slate-400">{totalPorArea(cc as "COCINA" | "BAR")}</span>
                </p>
                <div className="ml-1 flex flex-col">
                  {(cc === "BAR" ? totalSubrecetasBar : totalSubrecetasCocina) > 0 && (
                    <button
                      className={filaClase(esActiva({ tipo: "subrecetas", area: cc as "COCINA" | "BAR" }))}
                      style={filaEstilo(esActiva({ tipo: "subrecetas", area: cc as "COCINA" | "BAR" }))}
                      onClick={() => setSeccion({ tipo: "subrecetas", area: cc as "COCINA" | "BAR" })}
                    >
                      <span>🧪 Sub. Recetas</span>
                      <span className="text-xs opacity-70">
                        {cc === "BAR" ? totalSubrecetasBar : totalSubrecetasCocina}
                      </span>
                    </button>
                  )}
                  {[...familias.entries()]
                    .sort(([a], [b]) => a.localeCompare(b, "es"))
                    .map(([nombre, cantidad]) => (
                      <button
                        key={nombre}
                        className={filaClase(esActiva({ tipo: "familia", nombre }))}
                        style={filaEstilo(esActiva({ tipo: "familia", nombre }))}
                        onClick={() => setSeccion({ tipo: "familia", nombre })}
                      >
                        <span className="truncate">{nombre}</span>
                        <span className="text-xs opacity-70">{cantidad}</span>
                      </button>
                    ))}
                </div>
              </div>
            ))}

          {gruposFamilias.sinCC.size > 0 && (
            <div className="mt-1">
              <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">
                Sin centro de costo
              </p>
              <div className="ml-1 flex flex-col">
                {[...gruposFamilias.sinCC.entries()]
                  .sort(([a], [b]) => a.localeCompare(b, "es"))
                  .map(([nombre, cantidad]) => (
                    <button
                      key={nombre}
                      className={filaClase(esActiva({ tipo: "familia", nombre }))}
                      style={filaEstilo(esActiva({ tipo: "familia", nombre }))}
                      onClick={() => setSeccion({ tipo: "familia", nombre })}
                    >
                      <span className="truncate">{nombre}</span>
                      <span className="text-xs opacity-70">{cantidad}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>

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
            <div className="h-1.5 w-full shrink-0" style={{ background: colorDeItem(detalle.tipo === "subreceta", detalle.familia_nombre) }} />

            {/* Franja oscura con el nombre, igual que en el sistema viejo
                (09/11, a pedido de Mariluz) — reemplaza el encabezado
                blanco que tenía antes. */}
            <div className="relative px-5 py-4" style={{ background: COLOR_BANNER }}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em]" style={{ color: tema.acento }}>
                {detalle.tipo === "subreceta" ? "Sub. Recetas" : detalle.familia_nombre ?? "Recetario"}
              </p>
              <h2 className="mt-0.5 pr-8 font-serif text-xl text-white">{detalle.nombre}</h2>
              <button
                onClick={() => setDetalle(null)}
                className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

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
                        <th className="pb-1 text-right font-medium">Unidad de Medida</th>
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

              {pasosPreparacion.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Preparación
                  </p>
                  <ol className="flex flex-col gap-2">
                    {pasosPreparacion.map((paso, idx) => (
                      <li key={idx} className="flex gap-2 text-sm text-slate-700">
                        <span
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                          style={{ background: COLOR_BANNER }}
                        >
                          {idx + 1}
                        </span>
                        <span className="pt-0.5">{paso}</span>
                      </li>
                    ))}
                  </ol>
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
