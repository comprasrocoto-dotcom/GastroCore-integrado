"use client";

import { useState } from "react";
import {
  crearPlantilla,
  actualizarPlantilla,
  eliminarPlantilla,
  aplicarPlantillaAUsuarios,
} from "./plantillas-actions";
import { MODULOS_DISPONIBLES, type Modulo } from "@/lib/auth/modulos";
import type { PlantillaPermiso } from "@/lib/data/plantillas";
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
          Área (Bar / Cocina)
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

function FormularioNuevaPlantilla() {
  const [sinRestricciones, setSinRestricciones] = useState(true);
  const [modulosElegidos, setModulosElegidos] = useState<Modulo[]>([]);
  const [area, setArea] = useState<"" | "BAR" | "COCINA">("");

  return (
    <form
      action={crearPlantilla}
      className="card flex flex-col gap-3 p-3"
      style={{ maxWidth: 420 }}
    >
      <h3 className="text-sm font-semibold">Nueva plantilla</h3>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Nombre
        </span>
        <input name="nombre" required placeholder="ej. Cocinero" className={inputClase} />
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
        Crear plantilla
      </button>
    </form>
  );
}

function FilaPlantilla({
  plantilla,
  usuarios,
}: {
  plantilla: PlantillaPermiso;
  usuarios: UsuarioBasico[];
}) {
  const [sinRestricciones, setSinRestricciones] = useState(plantilla.modulos === null);
  const [modulosElegidos, setModulosElegidos] = useState<Modulo[]>(
    (plantilla.modulos ?? []) as Modulo[]
  );
  const [area, setArea] = useState<"" | "BAR" | "COCINA">(plantilla.area ?? "");
  const [usuariosElegidos, setUsuariosElegidos] = useState<string[]>([]);

  function alternarUsuario(id: string, marcado: boolean) {
    setUsuariosElegidos((actual) =>
      marcado ? [...actual, id] : actual.filter((u) => u !== id)
    );
  }

  return (
    <details className="card p-3" open>
      <summary className="cursor-pointer font-medium">{plantilla.nombre}</summary>

      <form
        action={actualizarPlantilla}
        className="mt-3 flex flex-col gap-3 border-b pb-3"
        style={{ borderColor: "var(--line)", maxWidth: 420 }}
      >
        <input type="hidden" name="id" value={plantilla.id} />
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Nombre
          </span>
          <input name="nombre" defaultValue={plantilla.nombre} className={inputClase} />
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

      <form action={eliminarPlantilla} className="mt-3">
        <input type="hidden" name="id" value={plantilla.id} />
        <button
          type="submit"
          className="btn-danger"
          onClick={(e) => {
            if (
              !confirm(
                `¿Eliminar la plantilla "${plantilla.nombre}"? Esto no le cambia nada a los usuarios que ya la hayan recibido antes.`
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          Eliminar plantilla
        </button>
      </form>

      <form action={aplicarPlantillaAUsuarios} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="plantilla_id" value={plantilla.id} />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Aplicar a estos usuarios
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
                `¿Aplicar la plantilla "${plantilla.nombre}" a ${usuariosElegidos.length} usuario(s)? Les va a reemplazar las pantallas y el área que tenían configuradas.`
              )
            ) {
              e.preventDefault();
            }
          }}
        >
          Aplicar a los usuarios marcados
        </button>
      </form>
    </details>
  );
}

/**
 * "Roles y permisos" (27/10): plantillas con un nombre + un conjunto de
 * pantallas y área ya elegido, para aplicárselo de una a varios usuarios
 * sin repetir la misma elección cada vez. No crea roles de seguridad
 * nuevos — Admin/Chef/Lector (y lo que cada uno puede hacer de verdad)
 * sigue siendo lo mismo de siempre; esto solo copia valores a
 * `usuarios.modulos`/`usuarios.area`, igual que si se editara cada
 * usuario a mano desde "Usuarios".
 */
export default function PlantillasPermisos({
  plantillas,
  usuarios,
}: {
  plantillas: PlantillaPermiso[];
  usuarios: UsuarioBasico[];
}) {
  return (
    <div className="flex flex-col gap-4">
      <FormularioNuevaPlantilla />
      <div className="flex flex-col gap-3">
        {plantillas.map((p) => (
          <FilaPlantilla key={p.id} plantilla={p} usuarios={usuarios} />
        ))}
        {plantillas.length === 0 && (
          <p className="text-sm text-slate-400">Todavía no hay ninguna plantilla creada.</p>
        )}
      </div>
    </div>
  );
}
