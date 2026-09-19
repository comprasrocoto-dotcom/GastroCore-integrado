import { notFound } from "next/navigation";
import { obtenerRecetarioDetalle } from "@/lib/data/recetario";

export default async function RecetarioDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const detalle = await obtenerRecetarioDetalle(params.id);
  if (!detalle) notFound();

  const { receta, ingredientes } = detalle;

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <p className="eyebrow">Recetario</p>
        <h1 className="text-xl font-semibold">{receta.receta_nombre}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {receta.familia_nombre ?? "Sin familia"}
          {receta.rendimiento
            ? ` · Rinde ${receta.rendimiento} ${receta.unidad_rendimiento_codigo ?? ""}`
            : ""}
          {receta.tiempo_min ? ` · ${receta.tiempo_min} min` : ""}
        </p>
      </div>

      <div className="card flex flex-col gap-2 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Ingredientes</h2>
        {ingredientes.length === 0 ? (
          <p className="text-sm text-slate-400">Sin ingredientes cargados.</p>
        ) : (
          <ul className="list-inside list-disc text-sm text-slate-700">
            {ingredientes.map((i, idx) => (
              <li key={idx}>
                {i.descripcion} — {i.cantidad} {i.unidad_codigo ?? ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      {receta.preparacion && (
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Preparación</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{receta.preparacion}</p>
        </div>
      )}

      {receta.emplatado && (
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Emplatado</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{receta.emplatado}</p>
        </div>
      )}

      {receta.notas && (
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Notas</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{receta.notas}</p>
        </div>
      )}
    </div>
  );
}
