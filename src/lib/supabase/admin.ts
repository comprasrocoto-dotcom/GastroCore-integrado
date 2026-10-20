import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente de Supabase con la service_role key — la única forma de crear
 * una cuenta de Auth en nombre de otra persona (lo que hace falta para
 * la pantalla Usuarios: Mariluz le pone el correo y la contraseña a cada
 * empleado). Esta clave bypasea RLS por completo, así que este cliente
 * se usa EXCLUSIVAMENTE adentro de server actions que ya verificaron que
 * quien llama es el Admin multi-marca (ver usuarios/actions.ts) —
 * jamás se expone al navegador.
 *
 * La clave nunca se asume ni se comitea (ver el comentario de
 * lib/supabase/server.ts): Mariluz la carga ella misma como variable de
 * entorno de servidor en Vercel (Project Settings → Environment
 * Variables → SUPABASE_SERVICE_ROLE_KEY, con el valor de Supabase →
 * Project Settings → API → service_role). Mientras no esté cargada, la
 * creación de usuarios muestra un error claro en vez de romperse.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY en Vercel — sin ella no se pueden crear usuarios nuevos."
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
