"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearUsuario, type EstadoUsuario } from "./actions";
import type { MarcaAdmin } from "@/lib/data/marcas";
import { MODULOS_DISPONIBLES, type Modulo } from "@/lib/auth/usuario-actual";

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

const estadoInicial: EstadoUsuario = { error: null };

function BotonCrear() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary">
      {pending ? "Creando…" : "Crear usuario"}
    </button>
  );
}

export default function CrearUsuarioForm({ marcas }: { marcas: MarcaAdmin[] }) {
  const [estado, formAction] = useFormState(crearUsuario, estadoInicial);
  const [rol, setRol] = useState<"Admin" | "Chef" | "Lector">("Chef");
  const [alcance, setAlcance] = useState<"todas" | "marca" | "sede">("sede");
  const [sedesElegidas, setSedesElegidas] = useState<string[]>([]);
  // Módulos y área (26/10): por defecto un usuario nuevo ve todo, igual
  // que siempre — recién si se destildan las "sin restricciones" aparece
  // la lista para elegir qué pantallas puede ver.
  const [sinRestricciones, setSinRestricciones] = useState(true);
  const [modulosElegidos, setModulosElegidos] = useState<Modulo[]>([]);
  const [area, setArea] = useState<"" | "BAR" | "COCINA">("");

  // Chef y Lector siempre son de una o varias sedes puntuales — no tiene
  // sentido ofrecerles "todas las marcas" o "una marca completa".
  const alcanceEfectivo = rol === "Admin" ? alcance : "sede";

  // Solo las marcas que tienen al menos una sede activa, para no mostrar
  // un grupo vacío en la lista de checkboxes.
  const marcasConSedes = useMemo(
    () => marcas.filter((m) => m.sedes.length > 0),
    [marcas]
  );

  function alternarSede(sedeId: string, marcada: boolean) {
    setSedesElegidas((actual) =>
      marcada ? [...actual, sedeId] : actual.filter((id) => id !== sedeId)
    );
  }

  function alternarModulo(modulo: Modulo, marcado: boolean) {
    setModulosElegidos((actual) =>
      marcado ? [...actual, modulo] : actual.filter((m) => m !== modulo)
    );
  }

  return (
    <form action={formAction} className="card flex flex-col gap-4 p-4" style={{ maxWidth: 480 }}>
      <h2 className="text-sm font-semibold">Crear usuario</h2>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Nombre</span>
        <input name="nombre" required className={inputClase} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Correo</span>
        <input name="email" type="email" required autoComplete="off" className={inputClase} />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Contraseña
        </span>
        <input
          name="password"
          type="text"
          required
          minLength={8}
          autoComplete="off"
          placeholder="Al menos 8 caracteres"
          className={inputClase}
        />
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Se la pasás vos directamente a la persona — no se envía ningún correo.
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Rol</span>
        <select
          name="rol"
          value={rol}
          onChange={(e) => setRol(e.target.value as typeof rol)}
          className={inputClase}
        >
          <option value="Chef">Chef — carga y edita recetas/insumos de su sede</option>
          <option value="Lector">Lector — solo puede ver (ej. Recetario)</option>
          <option value="Admin">Admin — administra, ve costos y precios</option>
        </select>
      </label>

      {rol === "Admin" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Alcance
          </span>
          <select
            name="alcance"
            value={alcance}
            onChange={(e) => setAlcance(e.target.value as typeof alcance)}
            className={inputClase}
          >
            <option value="todas">Todas las marcas (como vos)</option>
            <option value="marca">Una sola marca</option>
            <option value="sede">Una o varias sedes puntuales</option>
          </select>
        </label>
      )}

      {rol !== "Admin" && <input type="hidden" name="alcance" value="sede" />}

      {alcanceEfectivo === "marca" && (
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Marca
          </span>
          <select name="marca_id" required className={inputClase} defaultValue="">
            <option value="" disabled>
              Elegí una marca
            </option>
            {marcas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {alcanceEfectivo === "sede" && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sedes (elegí una o varias)
          </span>
          <div
            className="flex max-h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-slate-300 p-2"
          >
            {marcasConSedes.map((m) => (
              <div key={m.id} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500">{m.nombre}</span>
                {m.sedes.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 pl-2 text-sm">
                    <input
                      type="checkbox"
                      name="sede_ids"
                      value={s.id}
                      checked={sedesElegidas.includes(s.id)}
                      onChange={(e) => alternarSede(s.id, e.target.checked)}
                    />
                    {s.nombre}
                  </label>
                ))}
              </div>
            ))}
            {marcasConSedes.length === 0 && (
              <span className="text-sm text-slate-400">
                Todavía no hay ninguna sede cargada.
              </span>
            )}
          </div>
          {sedesElegidas.length === 0 && (
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Tenés que elegir al menos una sede.
            </span>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t pt-3" style={{ borderColor: "var(--line)" }}>
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          Pantallas que puede ver
        </span>
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
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          Si elegís Bar o Cocina, en Recetas y Recetario solo va a ver lo de esa área (según el
          campo &quot;Área&quot; de cada familia, en la pantalla Familias).
        </span>
      </label>

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {estado.error}
        </p>
      )}

      <BotonCrear />
    </form>
  );
}
