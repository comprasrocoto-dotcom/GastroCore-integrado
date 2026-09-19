import { getUsuarioActual } from "@/lib/auth/usuario-actual";

export default async function Home() {
  const usuario = await getUsuarioActual();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Bienvenida</p>
        <h1 className="text-2xl font-semibold">Hola, {usuario?.nombre ?? ""}</h1>
      </div>
      <div className="card p-5">
        <p style={{ color: "var(--ink)" }}>
          {usuario?.marca_id
            ? "Tenés acceso a tu marca."
            : "Tenés acceso a todas las marcas y sedes (maestro)."}
        </p>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Usá el menú de arriba para ir a Insumos, Familias, Subrecetas,
          Recetas o Recetario.
        </p>
      </div>
    </div>
  );
}
