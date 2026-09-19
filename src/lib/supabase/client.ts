"use client";

/**
 * Cliente de Supabase para usar en componentes de cliente (navegador).
 *
 * Usa la publishable/anon key, que es pública por diseño. Toda la
 * seguridad real la impone Postgres con RLS (Row Level Security) en el
 * proyecto `slbehczdonbzpneyglrx` (Gastro Central) — este cliente nunca
 * debe recibir la service_role key.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
