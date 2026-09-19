import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Cliente de Supabase para usar en Server Components, Route Handlers y
 * Server Actions. Lee/escribe la sesión desde las cookies de la petición.
 *
 * Igual que el cliente de navegador, usa la publishable/anon key — la
 * seguridad real la impone RLS en Postgres, no este archivo. La
 * service_role key (si algún día hace falta para una tarea de servidor
 * puntual) se guarda solo como variable de entorno de servidor y se pide
 * a Mariluz directamente, nunca se asume ni se comitea.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Se puede ignorar si se llama desde un Server Component:
            // el middleware se encarga de refrescar la sesión.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Igual que arriba.
          }
        },
      },
    }
  );
}
