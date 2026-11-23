import { getUsuarioActual, tieneModulo, esMaestro } from "@/lib/auth/usuario-actual";

type SeccionManual = {
  titulo: string;
  texto: string;
};

const MODULOS: SeccionManual[] = [
  {
    titulo: "Insumos",
    texto:
      "Acá vive cada materia prima que se compra: su nombre, referencia (código del ERP, si tiene), costo, unidad de medida, familia y subfamilia. El costo de cada insumo es la base de todos los cálculos del sistema — cuando sube el precio de un insumo, se recalcula automáticamente el costo de todas las recetas y subrecetas que lo usan. Desde \"Reemplazar insumos\" se puede subir un archivo nuevo (del ERP) para actualizar precios y unidades de toda la lista de una sola vez, en vez de editar insumo por insumo.",
  },
  {
    titulo: "Subrecetas",
    texto:
      "Una subreceta es una preparación intermedia (una salsa, un aderezo, una base) que después se usa como ingrediente dentro de una o varias recetas, igual que un insumo comprado. Cada subreceta tiene su propia lista de ingredientes (insumos u otras subrecetas) y su \"rendimiento\": cuánto produce esa preparación (por ejemplo, 2.000 gramos), para calcular el costo por gramo/unidad que después se usa en las recetas que la llevan.",
  },
  {
    titulo: "Recetas",
    texto:
      "Cada plato o bebida que se vende, con su lista de ingredientes (insumos y/o subrecetas), su costo por porción, su precio de venta y su Food Cost (qué porcentaje del precio es costo de materia prima). Desde el detalle de cada receta también se carga su ficha técnica (preparación, emplatado, notas y tiempo) y se descarga su PDF para cocina o barra, sin precios ni botones — solo la preparación.",
  },
  {
    titulo: "Familias",
    texto:
      "Agrupan recetas y subrecetas por categoría (Entradas, Fondos, Postres, Cócteles, etc.), y permiten definir un Food Cost objetivo propio por familia y un centro de costo, si se necesita reportar distinto a Cocina y a Bar.",
  },
  {
    titulo: "Configuración",
    texto:
      "Los parámetros generales de costeo de la sede: Food Cost objetivo, IVA/INC, estilo visual del Recetario, mermas estándar por insumo, y — para el Admin — Usuarios, Marcas/sedes y Roles y permisos (qué pantallas ve cada rol).",
  },
  {
    titulo: "Recetario",
    texto:
      "La vista de preparación para Cocina y Bar: la misma lista de recetas y subrecetas, pero mostrando solo lo que hace falta para prepararlas (ingredientes, cantidades, pasos y emplatado) — sin costos ni precios. Si la sede tiene clave cargada, pide elegir Bar o Cocina antes de entrar.",
  },
];

const MODULOS_ADMIN: SeccionManual[] = [
  {
    titulo: "Marcas",
    texto:
      "Solo para el Admin multi-marca: acá se administran las marcas y las sedes de cada una. Cada sede tiene su propia base de insumos, recetas y costos, completamente separada de las demás.",
  },
  {
    titulo: "Usuarios",
    texto:
      "Solo para el Admin multi-marca: acá se crean los usuarios que van a entrar al sistema, con su rol, su sede (o sedes) y qué módulos puede ver cada uno — para no mostrarle a nadie una pantalla que no le corresponde.",
  },
];

/**
 * Manual — ayuda básica de cada módulo del sistema, a pedido de Mariluz
 * (23/11) para calcar el link "Manual" del GastroCore viejo. El contenido
 * es un resumen en lenguaje llano de qué hace cada pantalla y cómo se
 * relacionan entre sí (insumo → subreceta → receta), escrito a partir de
 * cómo funciona hoy el sistema — se puede ajustar o ampliar cuando
 * Mariluz quiera agregar algo más específico.
 */
export default async function ManualPage() {
  const usuario = await getUsuarioActual();
  if (!usuario) return null;

  if (!tieneModulo(usuario, "manual")) {
    return (
      <p style={{ color: "var(--muted)" }}>
        No tenés permiso para ver esta pantalla.
      </p>
    );
  }

  const secciones = esMaestro(usuario) ? [...MODULOS, ...MODULOS_ADMIN] : MODULOS;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="eyebrow">Ayuda</p>
        <h1 className="text-xl font-semibold">Manual</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Qué es cada pantalla de Gastro Central y para qué sirve.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {secciones.map((s) => (
          <div key={s.titulo} className="card p-4">
            <h2 className="text-base font-semibold">{s.titulo}</h2>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {s.texto}
            </p>
          </div>
        ))}
      </div>

      <div
        className="rounded-lg px-3 py-2 text-xs"
        style={{ background: "rgba(37,99,235,0.06)", color: "var(--muted)" }}
      >
        💡 El orden general de trabajo es: cargar los <strong>Insumos</strong> con su costo real →
        armar las <strong>Subrecetas</strong> que los combinan → armar las <strong>Recetas</strong> que
        se venden, usando insumos y/o subrecetas → revisar el Food Cost de cada una.
      </div>
    </div>
  );
}
