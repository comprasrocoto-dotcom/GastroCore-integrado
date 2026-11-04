"use client";

import { useState } from "react";
import {
  crearRol,
  actualizarRol,
  eliminarRol,
  aplicarRolAUsuarios,
} from "./roles-actions";
import { MODULOS_DISPONIBLES, type Modulo } from "@/lib/auth/modulos";
import type { RolRow } from "@/lib/data/roles";
import type { UsuarioBasico } from "@/lib/data/usuarios";

const ETIQUETA_MODULO: Record<Modulo, string> = {
  insumos: "Insumos",
  subrecetas: "Subrecetas",
  recetas: "Recetas",
  familias: "Familias",
  configuracion: "Configuración",
  recetario: "Recetario",
};

const inputClase =
  "rounded-lg border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#1E3A5F]";

function SelectorModulosYArea({
  sinRestricciones,
  setSinRestricciones,
  modulosElegidos,
  setModulosElegidos,
  area,
  setArea,
}: {
  sinRestricciones: boolean;
  setSinRestricciones: (v: boolean) => void;
  modulosElegidos: Modulo[];
  setModulosElegidos: (v: Modulo[]) => void;
  area: "" | "BAR" | "COCINA";
  setArea: (v: "" | "BAR" | "COCINA") => void;
}) {
  function alternarModulo(modulo: Modulo, marcado: boolean) {
    setModulosElegidos(
      marcado ? [...modulosElegidos, modulo] : modulosElegidos.filter((m) => m !== modulo)
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="sin_restricciones_modulos"
            checked={sinRestricciones}
            onChange={(e) => setSinRestricciones(e.target.checked)}
          />
          Sin restricciones (ve todas las pantallas)
        </label>
        {!sinRestricciones && (
          <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-300 p-2">
            {MODULOS_DISPONIBLES.map((m) => (
              <label key={m} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="modulos"
                  value={m}
                  checked={modulosElegidos.includes(m)}
                  onChange={(e) => alternarModulo(m, e.target.checked)}
                />
                {ETIQUETA_MODULO[m]}
              </label>
            ))}
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Área (Bar / Cocina) por defecto
        </span>
        <select
          name="area"
          value={area}
          onChange={(e) => setArea(e.target.value as typeof area)}
          className={inputClase}
        >
          <option value="">Todas (sin restricción)</option>
          <option value="BAR">Bar</option>
          <option value="COCINA">Cocina</option>
        </select>
      </label>
    </>
  );
}

function FormularioNuevoRol() {
  const [accesoTotal, setAccesoTotal] = useState(false);
  const [sinRestricciones, setSinRestricciones] = useState(true);
  const [modulosElegidos, setModulosElegidos] = useState<Modulo[]>([]);
  const [area, setArea] = useState<"" | "BAR" | "COCINA">("");

  return (
    <form action={crearRol} className="card flex flex-col gap-3 p-3" style={{ maxWidth: 420 }}>
      <h3 className="text-sm font-semibold">Nuevo rol</h3>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Nombre
        </span>
        <input name="nombre" required placeholder="ej. Supervisor" className={inputClase} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="acceso_total"
          checked={accesoTotal}
          onChange={(e) => setAccesoTotal(e.target.checked)}
        />
        Acceso total (como Admin: puede crear marcas, sedes, usuarios y roles)
      </label>
      <SelectorModulosYArea
        sinRestricciones={sinRestricciones}
        setSinRestricciones={setSinRestricciones}
        modulosElegidos={modulosElegidos}
        setModulosElegidos={setModulosElegidos}
        area={area}
        setArea={setArea}
      />
      <button type="submit" className="btn-primary self-start">
        Crear rol
      </button>
    </form>
  );
}

function FilaRol({ rol, usuarios }: { rol: RolRow; usuarios: UsuarioBasico[] }) {
  const [accesoTotal, setAccesoTotal] = useState(rol.accesoTotal);
  const [sinRestricciones, setSinRestricciones] = useState(rol.modulos === null);
  const [modulosElegidos, setModulosElegidos] = useState<Modulo[]>(
    (rol.modulos ?? []) as Modulo[]
  );
  const [area, setArea] = useState<"" | "BAR" | "COCINA">(rol.area ?? "");
  const [usuariosElegidos, setUsuariosElegidos] = useState<string[]>([]);

  function alternarUsuario(id: string, marcado: boolean) {
    setUsuariosElegidos((actual) =>
      marcado ? [...actual, id] : actual.filter((u) => u !== id)
    );
  }

  return (
    <details className="card p-3" open>
      <summary className="cursor-pointer font-medium">
        {rol.nombre}
        {rol.esSistema && (
          <span className="ml-2 text-xs font-normal text-slate-400">
            (rol de sistema, protegido)
          </span>
        )}
        {rol.accesoTotal && (
          <span className="ml-2 text-xs font-normal" style={{ color: "var(--muted)" }}>
            · acceso total
          </span>
        )}
      </summary>

      {rol.esSistema ? (
        <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
          Este es uno de los 3 roles de siempre (Admin, Chef o Lector). No se puede renombrar,
          borrar ni cambiarle el acceso total desde acá, para no romper la seguridad de la app.
        </p>
      ) : (
        <>
          <form
            action={actualizarRol}
            className="mt-3 flex flex-col gap-3 border-b pb-3"
            style={{ borderColor: "var(--line)", maxWidth: 420 }}
          >
            <input type="hidden" name="id" value={rol.id} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Nombre
              </span>
              <input name="nombre" defaultValue={rol.nombre} className={inputClase} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="acceso_total"
                checked={accesoTotal}
                onChange={(e) => setAccesoTotal(e.target.checked)}
              />
              Acceso total (como Admin: puede crear marcas, sedes, usuarios y roles)
            </label>
            <SelectorModulosYArea
              sinRestricciones={sinRestricciones}
              setSinRestricciones={setSinRestricciones}
              modulosElegidos={modulosElegidos}
              setModulosElegidos={setModulosElegidos}
              area={area}
              setArea={setArea}
            />
            <div className="flex gap-2">
              <button type="submit" className="btn-secondary">
                Guardar
              </button>
            </div>
          </form>

          <form action={eliminarRol} className="mt-3">
            <input type="hidden" name="id" value={rol.id} />
            <button
              type="submit"
              className="btn-danger"
              onClick={(e) => {
                if (
                  !confirm(
                    `¿Eliminar el rol "${rol.nombre}"? Solo funciona si ya no hay ningún usuario con este rol asignado.`
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              Eliminar rol
            </button>
          </form>
        </>
      )}

      <form action={aplicarRolAUsuarios} className="mt-3 flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--line)" }}>
        <input type="hidden" name="rol_id" value={rol.id} />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Asignar este rol a estos usuarios
        </span>
        <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-slate-300 p-2">
          {usuarios.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="usuario_ids"
                value={u.id}
                checked={usuariosElegidos.includes(u.id)}
                onChange={(e) => alternarUsuario(u.id, e.target.checked)}
              />
              {u.nombre} <span className="text-xs text-slate-400">({u.email})</span>
            </label>
          ))}
          {usuarios.length === 0 && (
            <span className="text-sm text-slate-400">Todavía no hay usuarios creados.</span>
          )}
        </div>
        <button
          type="submit"
          className="btn-secondary self-start"
          disabled={usuariosElegidos.length === 0}
          onClick={(e) => {
            if (
              usuariosElegidos.length > 0 &&
              !confirm(
                `¿Asignar el rol "${rol.nombre}" a ${usuariosElegidos.length} usuario(s)? Les cambia el rol de verdad (qué pueden hacer) y les precarga las pantallas/área por defecto de este rol.`
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          Asignar a los usuarios marcados
        </button>
      </form>
    </details>
  );
}

/**
 * "Roles y permisos" (27/10): roles reales de usuario. Admin/Chef/Lector
 * son roles de sistema, protegidos — la seguridad de siempre no cambia.
 * Se pueden crear roles nuevos con nombre propio, marcando si tienen
 * acceso total (equivalente a Admin) o no, y con pantallas/área por
 * defecto para precargar en los usuarios a los que se les asigne.
 * Reemplaza a las "plantillas de permisos" de antes.
 */
export default function RolesPermisos({
  roles,
  usuarios,
}: {
  roles: RolRow[];
  usuarios: UsuarioBasico[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormularioNuevoRol />
      <div className="flex flex-col gap-3">
        {roles.map((r) => (
          <FilaRol key={r.id} rol={r} usuarios={usuarios} />
        ))}
      </div>
    </div>
  );
}
