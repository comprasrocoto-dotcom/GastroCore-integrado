import { getUsuarioActual } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import { obtenerConfiguracionCosteo } from "@/lib/data/configuracion";
import { guardarConfiguracion } from "./actions";

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

/**
 * Configuración — parámetros de costeo por sede (FC objetivo normal, FC
 * objetivo para un futuro Panel Ejecutivo, e IVA/INC). Antes de esta
 * pantalla eran constantes fijas en `lib/costeo.ts`; ahora se guardan en
 * la tabla `configuracion` (ya existía, vacía) y las mismas funciones de
 * costeo las usan si están cargadas, o los mismos valores de siempre si
 * no. Ninguna fórmula cambió.
 */
export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: { sede?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) {
    return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;
  }

  const config = await obtenerConfiguracionCosteo(sedeActiva.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow">{sedeActiva.marca_nombre} / {sedeActiva.nombre}</p>
        <h1 className="text-xl font-semibold">Configuración</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Parámetros de costeo de esta sede. Afectan el precio sugerido y el food cost que se
          muestran en Recetas — no cambian ninguna fórmula, solo estos valores.
        </p>
      </div>

      <form
        action={guardarConfiguracion}
        className="card flex flex-col gap-4 p-4"
        style={{ maxWidth: 480 }}
      >
        <input type="hidden" name="sede_id" value={sedeActiva.id} />

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Food cost objetivo
          </span>
          <input
            name="fc_objetivo"
            type="number"
            step="0.01"
            min="0.01"
            max="99"
            defaultValue={(config.fcObjetivo * 100).toFixed(2)}
            className={inputClase}
          />
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Se usa para calcular el precio sugerido de las recetas de esta sede (hoy: 35%).
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Food cost objetivo — Panel Ejecutivo
          </span>
          <input
            name="fc_objetivo_panel"
            type="number"
            step="0.01"
            min="0.01"
            max="99"
            defaultValue={(config.fcObjetivoPanel * 100).toFixed(2)}
            className={inputClase}
          />
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Se usará cuando exista el Panel Ejecutivo (hoy: 30%).
          </span>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Impuesto al consumo (IVA/INC)
          </span>
          <input
            name="iva"
            type="number"
            step="0.01"
            min="0"
            max="99"
            defaultValue={(config.iva * 100).toFixed(2)}
            className={inputClase}
          />
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Valor por defecto de la sede — cada receta puede tener su propio IVA en su edición
            avanzada, que manda por encima de este valor.
          </span>
        </label>

        <button type="submit" className="btn-primary self-start">
          Guardar
        </button>
      </form>
    </div>
  );
}
