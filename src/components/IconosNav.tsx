/**
 * Íconos de línea (trazo, sin relleno) para la barra lateral de navegación
 * (ver `HeaderProtegido.tsx`) — reemplazan a los emojis que se usaban antes
 * en el menú de arriba. Dibujados a mano como SVG inline, sin depender de
 * ninguna librería de íconos (así no hay que tocar package.json ni el
 * lockfile para subir este cambio).
 *
 * Todos comparten el mismo "look": trazo (`stroke`), sin relleno, puntas y
 * uniones redondeadas, 24x24 de viewBox. El color lo hereda de `currentColor`
 * (el componente que los usa controla el color con `className`/`style`).
 */
import type { SVGProps } from "react";

type IconoProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Insumos — caja/cubo (materia prima, inventario). */
export function IconoInsumos(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
      <path d="M3 7.5v9L12 21l9-4.5v-9" />
      <path d="M12 12v9" />
    </svg>
  );
}

/** Subrecetas — matraz/frasco (preparaciones intermedias). */
export function IconoSubrecetas(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9.5 3h5" />
      <path d="M10.5 3v6.3L5.1 18a2 2 0 0 0 1.7 3h10.4a2 2 0 0 0 1.7-3L13.5 9.3V3" />
      <path d="M7.8 15h8.4" />
    </svg>
  );
}

/** Recetas — libro cerrado (fichas de receta con costo). */
export function IconoRecetas(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v16H6.5A1.5 1.5 0 0 0 5 20.5V4.5Z" />
      <path d="M5 17.5A1.5 1.5 0 0 1 6.5 16H19" />
      <path d="M8.5 7.5h7" />
      <path d="M8.5 10.5h7" />
    </svg>
  );
}

/** Familias — carpeta (familias y subfamilias). */
export function IconoFamilias(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3 7a1.5 1.5 0 0 1 1.5-1.5h4l2 2.2h8A1.5 1.5 0 0 1 20 9.2V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 2 18V7Z" />
    </svg>
  );
}

/** Configuración — engranaje. */
export function IconoConfiguracion(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.97 7.97 0 0 0 0-3l1.9-1.3-1.5-2.6-2.2.8a8 8 0 0 0-2.6-1.5L14.6 3h-5.2l-.4 2.4a8 8 0 0 0-2.6 1.5l-2.2-.8-1.5 2.6 1.9 1.3a7.97 7.97 0 0 0 0 3L2.7 15l1.5 2.6 2.2-.8a8 8 0 0 0 2.6 1.5l.4 2.4h5.2l.4-2.4a8 8 0 0 0 2.6-1.5l2.2.8 1.5-2.6-1.9-1.5Z" />
    </svg>
  );
}

/** Recetario — libro abierto (preparación/emplatado para Bar y Cocina). */
export function IconoRecetario(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 6.3c-1.7-1.2-3.9-1.8-6.5-1.8v13c2.6 0 4.8.6 6.5 1.8" />
      <path d="M12 6.3c1.7-1.2 3.9-1.8 6.5-1.8v13c-2.6 0-4.8.6-6.5 1.8" />
      <path d="M12 6.3v13" />
    </svg>
  );
}

/** Marcas — etiqueta (marcas y sedes). */
export function IconoMarcas(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12.6 3.4 20 10.8a2 2 0 0 1 0 2.8l-6.4 6.4a2 2 0 0 1-2.8 0L3.4 12.6A2 2 0 0 1 3 11.2V5a2 2 0 0 1 2-2h6.2c.5 0 1 .2 1.4.6Z" />
      <circle cx="8" cy="8" r="1.3" />
    </svg>
  );
}

/** Usuarios — persona. */
export function IconoUsuarios(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

/** Salir — flecha saliendo de una puerta (cerrar sesión). */
export function IconoSalir(props: IconoProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 4H6a1.5 1.5 0 0 0-1.5 1.5v13A1.5 1.5 0 0 0 6 20h3" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </svg>
  );
}
