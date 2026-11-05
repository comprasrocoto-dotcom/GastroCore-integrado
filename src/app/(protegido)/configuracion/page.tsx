import Link from "next/link";
import { getUsuarioActual, tieneModulo, esMaestro } from "@/lib/auth/usuario-actual";
import { getSedesVisibles, resolverSedeActiva } from "@/lib/data/sedes";
import {
  obtenerConfiguracionCosteo,
  obtenerClavesRecetario,
  obtenerIdentidad,
} from "@/lib/data/configuracion";
import { listarFamiliasConSubfamilias } from "@/lib/data/familias";
import { listarRoles } from "@/lib/data/roles";
import { listarUsuariosBasico } from "@/lib/data/usuarios";
import { guardarConfiguracion, guardarClaves, recalcularCostosSede } from "./actions";
import { actualizarCentroCostoFamilia, actualizarFoodCostFamilia } from "@/app/(protegido)/familias/actions";
import RolesPermisos from "./RolesPermisos";
import EstiloRecetario from "./EstiloRecetario";
import MermasInsumo from "./MermasInsumo";
import BotonRecalcularCostos from "./BotonRecalcularCostos";

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

/**
 * Configuración — parámetros de costeo por sede (FC objetivo normal, FC
 * objetivo para un futuro Panel Ejecutivo, IVA/INC y alerta de insumos).
 * Antes de esta pantalla eran constantes fijas en `lib/costeo.ts`; ahora
 * se guardan en la tabla `configuracion` y las mismas funciones de
 * costeo las usan si están cargadas, o los mismos valores de siempre si
 * no. Ninguna fórmula cambió.
 *
 * Desde el 27/10 esta pantalla también reúne: Estilo del recetario
 * (paleta de colores), Centros de costo, Food cost por familia, Mermas
 * estándar por insumo, "Poner costos al día" y "Respaldo de la base" —
 * todo por sede — y, para el Admin multi-marca, Usuarios, Marcas/sedes y
 * Roles y permisos (ver RolesPermisos.tsx y docs/arquitectura.md).
 */
export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: { sede?: string; error?: string };
}) {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!tieneModulo(usuario, "configuracion")) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No tenés permiso para ver esta pantalla.
      </p>
    );
  }

  const sedesVisibles = await getSedesVisibles();
  const sedeActiva = resolverSedeActiva(usuario, sedesVisibles, searchParams.sede);
  if (!sedeActiva) {
    return <p style={{ color: "var(--muted)" }}>No hay ninguna sede disponible.</p>;
  }

  const esAdminMultiMarca = esMaestro(usuario);

  const [config, claves, familias, temaId, roles, usuariosBasico] = await Promise.all([
    obtenerConfiguracionCosteo(sedeActiva.id),
    obtenerClavesRecetario(sedeActiva.id),
    listarFamiliasConSubfamilias(sedeActiva.id),
    obtenerIdentidad(sedeActiva.id),
    esAdminMultiMarca ? listarRoles() : Promise.resolve([]),
    esAdminMultiMarca ? listarUsuariosBasico() : Promise.resolve([]),
  ]);

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

      {searchParams.error && (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "#fca5a5", background: "#fef2f2", color: "#b91c1c" }}
        >
          {searchParams.error}
        </div>
      )}

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

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Alerta roja si un insumo sube más de (%)
          </span>
          <input
            name="alerta_insumo"
            type="number"
            step="0.01"
            min="0"
            max="999"
            placeholder="Desactivada"
            defaultValue={config.alertaInsumoPct !== null ? (config.alertaInsumoPct * 100).toFixed(2) : ""}
            className={inputClase}
          />
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Cuando el último cambio de precio de un insumo supera este %, aparece resaltado en la
            lista de Insumos. Dejá vacío para desactivar la alerta.
          </span>
        </label>

        <button type="submit" className="btn-primary self-start">
          Guardar
        </button>
      </form>

      <div className="card flex flex-col gap-3 p-4" style={{ maxWidth: 560 }}>
        <div>
          <h2 className="text-sm font-semibold">Food cost por familia</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Excepciones al food cost objetivo de arriba, familia por familia. Vacío = usa el food
            cost general de esta sede. Es el mismo dato que ya existe en Familias; acá está más
            corto para cambiarlo rápido.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          {familias.map((f) => (
            <form
              key={f.id}
              action={actualizarFoodCostFamilia}
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"
              style={{ borderColor: "var(--line)" }}
            >
              <input type="hidden" name="id" value={f.id} />
              <span className="flex-1">{f.nombre}</span>
              <input
                name="fc_objetivo"
                type="number"
                step="0.01"
                min="0"
                max="99"
                placeholder="General"
                defaultValue={f.fcObjetivo !== null ? (f.fcObjetivo * 100).toFixed(2) : ""}
                className={`${inputClase} w-24`}
              />
              <span className="text-xs" style={{ color: "var(--muted)" }}>%</span>
              <button type="submit" className="btn-secondary">
                Guardar
              </button>
            </form>
          ))}
          {familias.length === 0 && (
            <p className="text-sm text-slate-400">Todavía no hay familias cargadas en esta sede.</p>
          )}
        </div>
      </div>

      <div className="card flex flex-col gap-3 p-4" style={{ maxWidth: 560 }}>
        <div>
          <h2 className="text-sm font-semibold">Mermas estándar por insumo</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            El % de merma típico de limpieza o porcionado. Al agregar el insumo en el editor de
            recetas, la merma llega precargada (siempre ajustable en la línea). No recalcula
            recetas existentes.
          </p>
        </div>
        <MermasInsumo sedeId={sedeActiva.id} />
      </div>

      <div className="card flex flex-col gap-3 p-4" style={{ maxWidth: 640 }}>
        <div>
          <h2 className="text-sm font-semibold">Estilo del recetario</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Cada sede puede tener su identidad: el estilo cambia el banner y los colores de
            categoría del Recetario público.
          </p>
        </div>
        <EstiloRecetario sedeId={sedeActiva.id} temaActualId={temaId ?? "rocoto"} />
      </div>

      <form
        action={guardarClaves}
        className="card flex flex-col gap-4 p-4"
        style={{ maxWidth: 480 }}
      >
        <input type="hidden" name="sede_id" value={sedeActiva.id} />

        <div>
          <h2 className="text-sm font-semibold">Claves del Recetario (Bar / Cocina)</h2>
          <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
            Para que cada puesto (Bar o Cocina) entre al Recetario y vea solo las recetas de su
            área (según el campo &quot;Área&quot; de cada familia, en la pantalla Familias). Dejá un campo
            vacío para que esa área quede abierta sin clave.
          </p>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Clave de Bar
          </span>
          <input
            name="clave_bar"
            type="text"
            inputMode="numeric"
            placeholder="ej. 1234"
            defaultValue={claves.bar ?? ""}
            className={inputClase}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Clave de Cocina
          </span>
          <input
            name="clave_cocina"
            type="text"
            inputMode="numeric"
            placeholder="ej. 5678"
            defaultValue={claves.cocina ?? ""}
            className={inputClase}
          />
        </label>

        <button type="submit" className="btn-primary self-start">
          Guardar claves
        </button>
      </form>

      <div className="flex flex-wrap gap-3">
        <div className="card flex flex-col gap-2 p-4" style={{ minWidth: 260 }}>
          <span className="text-sm font-semibold">🧮 Poner costos al día</span>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Barrido completo del costeo: subrecetas primero, platos después. No lo necesitás en
            el día a día (cada edición ya recalcula sola) — es una red de seguridad por si algo
            quedó desactualizado.
          </p>
          <BotonRecalcularCostos sedeId={sedeActiva.id} accion={recalcularCostosSede} />
        </div>

        <div className="card flex flex-col gap-2 p-4" style={{ minWidth: 260 }}>
          <span className="text-sm font-semibold">💾 Respaldo de la base</span>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Copia en Excel de insumos, familias, subrecetas y recetas de esta sede. Recomendado
            una vez al mes, guardada fuera de la app.
          </p>
          <a
            href={`/configuracion/respaldo?sede=${sedeActiva.id}`}
            className="btn-secondary self-start"
          >
            ⬇ Descargar copia (Excel)
          </a>
        </div>

        <div className="card flex flex-col gap-2 p-4" style={{ minWidth: 260 }}>
          <span className="text-sm font-semibold">📁 Carpeta de fotos</span>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Las fotos de recetas y subrecetas se guardan en Supabase (no en Google Drive),
            organizadas automáticamente por sede. Se suben directo desde &quot;Subir foto&quot; en cada
            receta o subreceta — no hace falta configurar nada acá.
          </p>
        </div>
      </div>

      {esAdminMultiMarca && (
        <>
          <div className="mt-2 border-t pt-6" style={{ borderColor: "var(--line)" }}>
            <h2 className="text-lg font-semibold">Administración</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              Reservado al Admin multi-marca: usuarios, marcas y sedes, centros de costo y roles.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/usuarios"
              className="card flex flex-col gap-1 p-4"
              style={{ minWidth: 220 }}
            >
              <span className="text-sm font-semibold">👤 Usuarios</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Crear cuentas, activar/desactivar y editar rol, sedes, pantallas y área de cada una.
              </span>
            </Link>
            <Link
              href="/marcas"
              className="card flex flex-col gap-1 p-4"
              style={{ minWidth: 220 }}
            >
              <span className="text-sm font-semibold">🏷️ Marcas y sedes</span>
              <span className="text-xs" style={{ color: "var(--muted)" }}>
                Crear, renombrar, activar/desactivar o eliminar marcas y sedes.
              </span>
            </Link>
          </div>

          <div className="card flex flex-col gap-3 p-4" style={{ maxWidth: 560 }}>
            <div>
              <h3 className="text-sm font-semibold">Centros de costo</h3>
              <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                El campo &quot;Área&quot; de cada familia de {sedeActiva.nombre} — decide qué ve cada
                usuario o clave de Bar/Cocina en Recetas y el Recetario. Es el mismo campo que ya
                existe en Familias; acá está más corto para cambiarlo rápido.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {familias.map((f) => (
                <form
                  key={f.id}
                  action={actualizarCentroCostoFamilia}
                  className="flex flex-wrap items-center justify-between gap-2 border-b pb-2 text-sm"
                  style={{ borderColor: "var(--line)" }}
                >
                  <input type="hidden" name="id" value={f.id} />
                  <span className="flex-1">{f.nombre}</span>
                  <select
                    name="centrocosto"
                    defaultValue={(f.centrocosto ?? "").toUpperCase()}
                    className={inputClase}
                  >
                    <option value="">Sin asignar</option>
                    <option value="BAR">Bar</option>
                    <option value="COCINA">Cocina</option>
                    <option value="AMBAS">Ambas</option>
                  </select>
                  <button type="submit" className="btn-secondary">
                    Guardar
                  </button>
                </form>
              ))}
              {familias.length === 0 && (
                <p className="text-sm text-slate-400">
                  Todavía no hay familias cargadas en esta sede.
                </p>
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold">Roles y permisos</h3>
            <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
              Admin, Chef y Lector son roles de sistema protegidos. Se pueden crear roles nuevos
              con nombre propio, marcando si tienen acceso total o no, y con pantallas/área por
              defecto para asignar a uno o varios usuarios de una sola vez.
            </p>
            <div className="mt-3">
              <RolesPermisos roles={roles} usuarios={usuariosBasico} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
