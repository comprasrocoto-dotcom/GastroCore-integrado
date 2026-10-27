/** Módulos que se pueden restringir por usuario desde "Usuarios" (ver
 * CrearUsuarioForm/EditarUsuarioForm). "Marcas" y "Usuarios" no están acá
 * porque ya están reservados al Admin multi-marca por otro lado.
 *
 * Este archivo vive separado de `usuario-actual.ts` a propósito: ese
 * archivo tiene `import "server-only"`, y CrearUsuarioForm/EditarUsuarioForm
 * son componentes de cliente que necesitan esta lista para pintar los
 * checkboxes — si la importaran desde ahí, Next.js rompe el build porque
 * un componente de cliente no puede importar nada de un módulo marcado
 * como solo-servidor, aunque lo que use sea "inocente" (una constante). */
export const MODULOS_DISPONIBLES = [
  "insumos",
  "subrecetas",
  "recetas",
  "familias",
  "configuracion",
  "recetario",
] as const;
export type Modulo = (typeof MODULOS_DISPONIBLES)[number];
