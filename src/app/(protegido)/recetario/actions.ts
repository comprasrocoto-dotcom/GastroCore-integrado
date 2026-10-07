"use server";

import { cookies } from "next/headers";
import { obtenerDetalleRecetario, type RecetarioDetalle } from "@/lib/data/recetario";
import { obtenerClavesRecetario } from "@/lib/data/configuracion";

/**
 * Server Action que llama el modal de detalle del Recetario (cliente) al
 * hacer clic en una tarjeta — así no hace falta navegar a otra página.
 */
export async function cargarDetalleRecetario(
  tipo: "receta" | "subreceta",
  id: string
): Promise<RecetarioDetalle | null> {
  return obtenerDetalleRecetario(tipo, id);
}

export const COOKIE_AREA_RECETARIO = (sedeId: string) => `rec_area_${sedeId}`;

/**
 * Verifica la clave de Bar o Cocina para esta sede (cargadas en
 * Configuración) y, si coincide, guarda el área elegida en una cookie
 * (por sede, dura la sesión del navegador) para no volver a pedirla en
 * cada visita al Recetario desde ese mismo dispositivo.
 */
export async function verificarClaveRecetario(
  sedeId: string,
  area: "BAR" | "COCINA",
  clave: string
): Promise<{ ok: boolean; error?: string }> {
  if (!sedeId || !clave.trim()) {
    return { ok: false, error: "Ingresá la clave." };
  }

  const claves = await obtenerClavesRecetario(sedeId);
  const claveEsperada = area === "BAR" ? claves.bar : claves.cocina;

  if (!claveEsperada || claveEsperada !== clave.trim()) {
    return { ok: false, error: "Clave incorrecta." };
  }

  cookies().set(COOKIE_AREA_RECETARIO(sedeId), area, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 horas — alcanza para un turno de trabajo.
  });

  return { ok: true };
}
