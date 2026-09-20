"use client";

import { useState } from "react";

type OpcionInsumo = {
  id: string;
  etiqueta: string;
  coste: number;
  unidad_codigo: string | null;
};

type OpcionSubreceta = {
  id: string;
  etiqueta: string;
  costo_unitario: number;
};

/**
 * Fila de "agregar ingrediente" que vive dentro de la misma tabla de
 * ingredientes (en vez de dos paneles separados más abajo). Los campos no
 * están anidados dentro de un <form> — usan el atributo `form` para
 * apuntar a un <form> vacío que la página renderiza fuera de la tabla
 * (`<form id={formId} action={...} />`), porque un <form> no puede ser
 * hijo directo de un <tbody>.
 */
export default function FilaAgregarIngrediente({
  formId,
  variant,
  insumos,
  subrecetas,
}: {
  formId: string;
  variant: "receta" | "subreceta";
  insumos: OpcionInsumo[];
  subrecetas: OpcionSubreceta[];
}) {
  const [tipo, setTipo] = useState<"insumo" | "subreceta">("insumo");

  const selectClase =
    "w-full min-w-[9rem] rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[#1E3A5F]";
  const inputClase =
    "w-full min-w-[4.5rem] rounded-md border border-slate-300 px-2 py-1 text-xs outline-none focus:border-[#1E3A5F]";

  const selectorItem = (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        <button
          type="button"
          onClick={() => setTipo("insumo")}
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
            tipo === "insumo" ? "bg-[#1E3A5F] text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          Insumo
        </button>
        <button
          type="button"
          onClick={() => setTipo("subreceta")}
          className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${
            tipo === "subreceta" ? "bg-[#1E3A5F] text-white" : "bg-slate-100 text-slate-500"
          }`}
        >
          Subreceta
        </button>
      </div>
      <input type="hidden" name="tipo_item" value={tipo} form={formId} />
      {tipo === "insumo" ? (
        <select name="insumo_id" required defaultValue="" className={selectClase} form={formId}>
          <option value="">— Elegir insumo —</option>
          {insumos.map((i) => (
            <option key={i.id} value={i.id}>
              {i.etiqueta} ({i.coste.toFixed(2)}/{i.unidad_codigo ?? "?"})
            </option>
          ))}
        </select>
      ) : (
        <select name="subreceta_ref_id" required defaultValue="" className={selectClase} form={formId}>
          <option value="">— Elegir subreceta —</option>
          {subrecetas.map((s) => (
            <option key={s.id} value={s.id}>
              {s.etiqueta} ({s.costo_unitario.toFixed(4)})
            </option>
          ))}
        </select>
      )}
    </div>
  );

  const cantidadInput = (
    <input
      name="cantidad"
      type="number"
      step="0.01"
      required
      placeholder="Cantidad"
      className={inputClase}
      form={formId}
    />
  );
  const unidadInput = (
    <input name="unidad_codigo" placeholder="Unidad" className={inputClase} form={formId} />
  );
  const mermaInput = (
    <input
      name="merma_pct"
      type="number"
      step="0.01"
      placeholder="% Merma"
      className={inputClase}
      form={formId}
    />
  );
  const submitButton = (
    <button type="submit" form={formId} className="btn-secondary whitespace-nowrap px-2 py-1 text-xs">
      + Agregar
    </button>
  );

  if (variant === "receta") {
    // columnas: Insumo | Unidad | Cantidad | % Merma | Cant. real | Costo unit. | Costo total | Acciones
    return (
      <tr className="bg-slate-50/70">
        <td className="py-2 align-top">{selectorItem}</td>
        <td className="py-2 align-top">{unidadInput}</td>
        <td className="py-2 text-right align-top">{cantidadInput}</td>
        <td className="py-2 text-right align-top">{mermaInput}</td>
        <td className="py-2 text-right align-top text-slate-300">—</td>
        <td className="py-2 text-right align-top text-slate-300">—</td>
        <td className="py-2 text-right align-top text-slate-300">—</td>
        <td className="py-2 text-right align-top">{submitButton}</td>
      </tr>
    );
  }

  // variant "subreceta": columnas: Ítem | Cantidad | Unidad | Merma % | Costo unitario | Costo línea | Acciones
  return (
    <tr className="bg-slate-50/70">
      <td className="py-2 align-top">{selectorItem}</td>
      <td className="py-2 text-right align-top">{cantidadInput}</td>
      <td className="py-2 align-top">{unidadInput}</td>
      <td className="py-2 text-right align-top">{mermaInput}</td>
      <td className="py-2 text-right align-top text-slate-300">—</td>
      <td className="py-2 text-right align-top text-slate-300">—</td>
      <td className="py-2 text-right align-top">{submitButton}</td>
    </tr>
  );
}
