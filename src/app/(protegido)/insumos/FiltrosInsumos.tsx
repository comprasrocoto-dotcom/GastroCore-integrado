"use client";

/**
 * Dropdowns de "Subfamilia" y "Centro de costo" de Insumos (23/11, pedido
 * de Mariluz: poder ver solo una subfamilia, ej. "ver solo Licores", y
 * calcar los filtros del GastroCore viejo). Igual patrón que
 * `SelectorSede`: un cambio en el dropdown navega de una con el filtro
 * nuevo en la URL (sin tocar los demás query params), reseteando la
 * página a 1 para no quedar en una página que ya no existe con el filtro
 * nuevo aplicado.
 *
 * "Centro de costo" es un campo de texto libre que no todas las sedes
 * tienen cargado todavía (ver `listarCentrosCosto`) — si la sede no tiene
 * ninguno cargado, el dropdown ni aparece, para no mostrar un filtro que
 * nunca va a tener opciones.
 */
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function FiltrosInsumos({
  subfamilias,
  centrosCosto,
}: {
  subfamilias: { id: string; nombre: string; familia_nombre: string }[];
  centrosCosto: string[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function actualizar(campo: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(campo, valor);
    else params.delete(campo);
    params.delete("pagina");
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={searchParams.get("subfamilia") ?? ""}
        onChange={(e) => actualizar("subfamilia", e.target.value)}
        className="rounded-lg border px-2 py-1.5 text-sm"
        style={{ borderColor: "var(--line)" }}
      >
        <option value="">Todas las subfamilias</option>
        {subfamilias.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>

      {centrosCosto.length > 0 && (
        <select
          value={searchParams.get("centrocosto") ?? ""}
          onChange={(e) => actualizar("centrocosto", e.target.value)}
          className="rounded-lg border px-2 py-1.5 text-sm"
          style={{ borderColor: "var(--line)" }}
        >
          <option value="">Centro de costo (todos)</option>
          {centrosCosto.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
