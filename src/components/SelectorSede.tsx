"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { SedeConMarca } from "@/lib/data/sedes";

export default function SelectorSede({
  sedes,
  sedeActivaId,
}: {
  sedes: SedeConMarca[];
  sedeActivaId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (sedes.length <= 1) {
    return sedes[0] ? (
      <span className="chip chip-success">
        {sedes[0].marca_nombre} · {sedes[0].nombre}
      </span>
    ) : null;
  }

  const marcas = Array.from(new Set(sedes.map((s) => s.marca_nombre)));

  function cambiarSede(sedeId: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("sede", sedeId);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <select
      value={sedeActivaId ?? ""}
      onChange={(e) => cambiarSede(e.target.value)}
      className="rounded-lg border px-2 py-1.5 text-sm"
      style={{ borderColor: "var(--line)" }}
    >
      {marcas.map((marca) => {
        const sedesDeMarca = sedes.filter((s) => s.marca_nombre === marca);

        // Marca de una sola sede: una sola opción plana con el nombre de
        // la marca (sin repetir "Marca · Marca" como antes).
        if (sedesDeMarca.length === 1) {
          const unica = sedesDeMarca[0];
          return (
            <option key={unica.id} value={unica.id}>
              {marca}
            </option>
          );
        }

        // Marca con varias sedes reales (ej. 123 WOK): se agrupan bajo
        // el nombre de la marca porque cada sede tiene su propia carta
        // de recetas y costos — no hay una vista combinada posible.
        return (
          <optgroup key={marca} label={marca}>
            {sedesDeMarca.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </optgroup>
        );
      })}
    </select>
  );
}
