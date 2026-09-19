"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { SedeConMarca } from "@/lib/data/sedes";
import SelectorSede from "@/components/SelectorSede";
import TemaToggle from "@/components/TemaToggle";
import { logout } from "@/app/login/actions";

/**
 * Header + navegación de las pantallas protegidas. Mismo look que
 * GastroCore (logo, iconos, TemaToggle, contenedor app-shell) — la
 * diferencia es que acá también vive el selector de marca/sede. Es un
 * componente de cliente porque necesita leer el query param `sede` de la
 * URL actual con `useSearchParams()` para armar los links de navegación —
 * un Layout de Next.js (a diferencia de una Page) no puede recibir
 * `searchParams` como prop, así que esa parte no puede resolverse en el
 * layout de servidor.
 */
/**
 * Orden y módulos calcados del GastroCore real (ver capturas de
 * referencia de Mariluz, 19/09): Insumos, Subrecetas, Recetas, Familias,
 * Panel, Análisis, Usuarios, Manual, Configuración. Los últimos cinco
 * todavía no existen como pantallas en Gastro Central — se agregan acá
 * recién cuando cada uno esté construido, para no dejar links rotos.
 * "Recetario" (solo preparación/emplatado, sin costos) es una pantalla
 * propia de Gastro Central que no existe en el GastroCore real — se deja
 * al final, después de los módulos que sí tienen equivalente.
 */
const NAV = [
  { href: "/insumos", label: "Insumos", icon: "📦" },
  { href: "/subrecetas", label: "Subrecetas", icon: "🥣" },
  { href: "/recetas", label: "Recetas", icon: "📘" },
  { href: "/familias", label: "Familias", icon: "🗂️" },
  { href: "/recetario", label: "Recetario", icon: "📖" },
];

export default function HeaderProtegido({
  usuarioNombre,
  usuarioRol,
  sedesVisibles,
  sedeIdPorDefecto,
}: {
  usuarioNombre: string;
  usuarioRol: string;
  sedesVisibles: SedeConMarca[];
  sedeIdPorDefecto: string | null;
}) {
  const searchParams = useSearchParams();
  const sedeParam = searchParams.get("sede");
  const sedeActivaId =
    (sedeParam && sedesVisibles.some((s) => s.id === sedeParam) ? sedeParam : null) ??
    sedeIdPorDefecto;

  const conSede = (ruta: string) => (ruta === "/" ? ruta : sedeActivaId ? `${ruta}?sede=${sedeActivaId}` : ruta);

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/90 backdrop-blur">
      <nav className="app-shell flex items-center gap-1 py-2 overflow-x-auto">
        <Link href="/" className="mr-2 flex items-center gap-2 font-display text-lg font-bold text-[#1E3A5F]">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1E3A5F] text-sm font-bold text-white">
            GC
          </span>
          Gastro Central
        </Link>
        <div className="mx-2 h-6 w-px bg-black/10" />
        {NAV.map((n) => (
          <Link
            key={n.href}
            href={conSede(n.href)}
            className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-[#1E3A5F] hover:bg-[#EFF6FF]"
          >
            <span>{n.icon}</span>
            {n.label}
          </Link>
        ))}
        <div className="ml-auto flex items-center gap-3 pl-3">
          <SelectorSede sedes={sedesVisibles} sedeActivaId={sedeActivaId} />
          <TemaToggle />
          <span className="hidden whitespace-nowrap text-sm text-slate-500 sm:inline">
            {usuarioNombre} · {usuarioRol}
          </span>
          <form action={logout}>
            <button
              type="submit"
              className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Salir
            </button>
          </form>
        </div>
      </nav>
    </header>
  );
}
