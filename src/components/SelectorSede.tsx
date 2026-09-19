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
      {marcas.map((marca) => (
        <optgroup key={marca} label={marca}>
          {sedes
            .filter((s) => s.marca_nombre === marca)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}
