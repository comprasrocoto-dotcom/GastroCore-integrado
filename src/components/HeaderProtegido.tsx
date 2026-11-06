"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { SedeConMarca } from "@/lib/data/sedes";
import SelectorSede from "@/components/SelectorSede";
import TemaToggle from "@/components/TemaToggle";
import LogoGastroCentral from "@/components/LogoGastroCentral";
import {
  IconoInsumos,
  IconoSubrecetas,
  IconoRecetas,
  IconoFamilias,
  IconoConfiguracion,
  IconoRecetario,
  IconoMarcas,
  IconoUsuarios,
  IconoSalir,
} from "@/components/IconosNav";
import { logout } from "@/app/login/actions";

/**
 * Navegación de las pantallas protegidas (01/11: pasó de un menú horizontal
 * arriba a una barra lateral de íconos, a pedido de Mariluz, inspirada en
 * una herramienta externa que usa — ver docs/arquitectura.md). El archivo
 * sigue llamándose "HeaderProtegido" porque sigue siendo el único
 * componente de navegación del layout protegido (`layout.tsx` lo importa
 * una sola vez); lo que cambió es cómo se ve, no su rol.
 *
 * Es un componente de cliente porque necesita leer el query param `sede`
 * de la URL actual con `useSearchParams()` para armar los links, y la ruta
 * actual con `usePathname()` para resaltar la sección activa.
 */
/**
 * Orden y módulos calcados del GastroCore real (ver capturas de
 * referencia de Mariluz, 19/09): Insumos, Subrecetas, Recetas, Familias,
 * Panel, Análisis, Usuarios, Manual, Configuración. Configuración ya se
 * construyó (21/09) y se agregó acá; Panel, Análisis y Manual todavía no
 * existen como pantallas en Gastro Central — se agregan recién cuando
 * cada uno esté construido, para no dejar links rotos. "Recetario" (solo
 * preparación/emplatado, sin costos) es una pantalla propia de Gastro
 * Central que no existe en el GastroCore real — se deja al final,
 * después de los módulos que sí tienen equivalente.
 *
 * "Marcas" y "Usuarios" (20/10) son pantallas nuevas, reservadas al
 * Admin multi-marca — no están en este array fijo porque solo deben
 * aparecer para ese rol; se agregan condicionalmente más abajo.
 *
 * Desde el 26/10, cada usuario puede tener una lista de módulos
 * permitidos (`usuarios.modulos`, ver "Usuarios") — si la tiene, acá se
 * filtra para no mostrar ni un link a lo que no puede ver. La pantalla
 * en sí también se bloquea si se entra por URL directa (ver los guards
 * en cada page.tsx) — este filtro es solo para no mostrar el link.
 */
const NAV = [
  { href: "/insumos", label: "Insumos", Icono: IconoInsumos },
  { href: "/subrecetas", label: "Subrecetas", Icono: IconoSubrecetas },
  { href: "/recetas", label: "Recetas", Icono: IconoRecetas },
  { href: "/familias", label: "Familias", Icono: IconoFamilias },
  { href: "/configuracion", label: "Configuración", Icono: IconoConfiguracion },
  { href: "/recetario", label: "Recetario", Icono: IconoRecetario },
];

const NAV_MAESTRO = [
  { href: "/marcas", label: "Marcas", Icono: IconoMarcas },
  { href: "/usuarios", label: "Usuarios", Icono: IconoUsuarios },
];

export default function HeaderProtegido({
  usuarioNombre,
  usuarioRol,
  esMaestro,
  sedesVisibles,
  sedeIdPorDefecto,
  modulosPermitidos,
}: {
  usuarioNombre: string;
  usuarioRol: string;
  esMaestro: boolean;
  sedesVisibles: SedeConMarca[];
  sedeIdPorDefecto: string | null;
  modulosPermitidos: string[] | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sedeParam = searchParams.get("sede");
  const sedeActivaId =
    (sedeParam && sedesVisibles.some((s) => s.id === sedeParam) ? sedeParam : null) ??
    sedeIdPorDefecto;

  const conSede = (ruta: string) => (ruta === "/" ? ruta : sedeActivaId ? `${ruta}?sede=${sedeActivaId}` : ruta);

  const navBase =
    esMaestro || !modulosPermitidos
      ? NAV
      : NAV.filter((n) => modulosPermitidos.includes(n.href.slice(1)));
  const navCompleto = esMaestro ? [...navBase, ...NAV_MAESTRO] : navBase;

  const esActiva = (href: string) => pathname === href || pathname?.startsWith(href + "/");

  return (
    <>
      {/* Barra lateral de íconos — solo en pantallas md y más anchas.
          Fija a la izquierda; el layout le deja el espacio con
          `md:pl-[72px]` (ver layout.tsx). */}
      <aside
        className="fixed inset-y-0 left-0 z-40 hidden w-[72px] flex-col items-center gap-1 overflow-y-auto py-4 md:flex"
        style={{ background: "var(--brand)" }}
      >
        <Link
          href="/"
          title="Gastro Central"
          className="mb-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/90 hover:bg-white/10"
        >
          <LogoGastroCentral className="h-7 w-7" />
        </Link>

        <nav className="flex flex-1 flex-col items-center gap-1">
          {navCompleto.map((n) => {
            const activa = esActiva(n.href);
            return (
              <Link
                key={n.href}
                href={conSede(n.href)}
                title={n.label}
                aria-label={n.label}
                aria-current={activa ? "page" : undefined}
                className={
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors " +
                  (activa ? "bg-white text-[#1E3A5F]" : "text-white/80 hover:bg-white/10 hover:text-white")
                }
              >
                <n.Icono className="h-5 w-5" />
              </Link>
            );
          })}
        </nav>

        <form action={logout} title="Salir">
          <button
            type="submit"
            aria-label="Salir"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white"
          >
            <IconoSalir className="h-5 w-5" />
          </button>
        </form>
      </aside>

      {/* Franja superior — queda a la derecha de la barra lateral en
          desktop (md:pl-[72px] via layout.tsx) y ocupa todo el ancho en
          mobile, donde además muestra los mismos íconos en una fila
          horizontal con scroll (la barra lateral fija no se ve ahí). */}
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/90 backdrop-blur">
        <div className="app-shell flex items-center gap-3 py-2">
          <Link
            href="/"
            className="flex items-center gap-2 font-display text-base font-bold text-[#1E3A5F] md:hidden"
          >
            <LogoGastroCentral className="h-7 w-7 shrink-0" />
            Gastro Central
          </Link>
          <div className="ml-auto flex items-center gap-3">
            <SelectorSede sedes={sedesVisibles} sedeActivaId={sedeActivaId} />
            <TemaToggle />
            <span className="hidden whitespace-nowrap text-sm text-slate-500 sm:inline">
              {usuarioNombre} · {usuarioRol}
            </span>
            <form action={logout} className="md:hidden">
              <button
                type="submit"
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                Salir
              </button>
            </form>
          </div>
        </div>

        {/* Fila de íconos horizontal, solo mobile (reemplaza a la barra
            lateral, que ahí queda oculta). */}
        <nav className="app-shell flex items-center gap-1 overflow-x-auto pb-2 md:hidden">
          {navCompleto.map((n) => {
            const activa = esActiva(n.href);
            return (
              <Link
                key={n.href}
                href={conSede(n.href)}
                aria-current={activa ? "page" : undefined}
                className={
                  "flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors " +
                  (activa ? "bg-[#EFF6FF] text-[#1E3A5F]" : "text-[#1E3A5F]/80 hover:bg-[#EFF6FF]")
                }
              >
                <n.Icono className="h-5 w-5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
    </>
  );
}
