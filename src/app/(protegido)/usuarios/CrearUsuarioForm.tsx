"use client";

import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { crearUsuario, type EstadoUsuario } from "./actions";
import type { MarcaAdmin } from "@/lib/data/marcas";

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

  // Chef y Lector siempre son de una sede puntual — no tiene sentido
  // ofrecerles "todas las marcas" o "una marca completa".
  const alcanceEfectivo = rol === "Admin" ? alcance : "sede";

  const sedesDeLaMarca = useMemo(() => {
    const todas = marcas.flatMap((m) => m.sedes.map((s) => ({ ...s, marcaNombre: m.nombre })));
    return todas;
  }, [marcas]);

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
            <option value="sede">Una sola sede</option>
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
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Sede
          </span>
          <select name="sede_id" required className={inputClase} defaultValue="">
            <option value="" disabled>
              Elegí una sede
            </option>
            {sedesDeLaMarca.map((s) => (
              <option key={s.id} value={s.id}>
                {s.marcaNombre} / {s.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      {estado.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {estado.error}
        </p>
      )}

      <BotonCrear />
    </form>
  );
}
