import { notFound } from "next/navigation";
import Link from "next/link";
import { obtenerDetalleRecetario } from "@/lib/data/recetario";

export default async function RecetarioDetallePage({
  params,
}: {
  params: { id: string };
}) {
  const detalle = await obtenerDetalleRecetario("receta", params.id);
  if (!detalle) notFound();

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <p className="eyebrow">
          <Link href="/recetario" className="hover:underline">
            Recetario
          </Link>
        </p>
        <h1 className="text-xl font-semibold">{detalle.nombre}</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          {detalle.familia_nombre ?? "Sin familia"}
          {detalle.rendimiento
            ? ` · Rinde ${detalle.rendimiento} ${detalle.unidad_rendimiento_codigo ?? ""}`
            : ""}
          {detalle.tiempo_min ? ` · ${detalle.tiempo_min} min` : ""}
        </p>
      </div>

      {detalle.foto_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={detalle.foto_url} alt="" className="max-h-72 w-full rounded-lg object-cover" />
      )}

      <div className="card flex flex-col gap-2 p-5">
        <h2 className="text-sm font-semibold text-slate-700">Ingredientes</h2>
        {detalle.ingredientes.length === 0 ? (
          <p className="text-sm text-slate-400">Sin ingredientes cargados.</p>
        ) : (
          <ul className="list-inside list-disc text-sm text-slate-700">
            {detalle.ingredientes.map((i, idx) => (
              <li key={idx}>
                {i.descripcion} — {i.cantidad} {i.unidad_codigo ?? ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      {detalle.preparacion && (
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Preparación</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{detalle.preparacion}</p>
        </div>
      )}

      {detalle.emplatado && (
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Emplatado</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{detalle.emplatado}</p>
        </div>
      )}

      {detalle.notas && (
        <div className="card flex flex-col gap-2 p-5">
          <h2 className="text-sm font-semibold text-slate-700">Notas</h2>
          <p className="whitespace-pre-line text-sm text-slate-700">{detalle.notas}</p>
        </div>
      )}
    </div>
  );
}
