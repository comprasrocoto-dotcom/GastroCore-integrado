"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoLogin = { error: string | null };

export async function login(
  _estadoPrevio: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/");

  if (!email || !password) {
    return { error: "Ingresá correo y contraseña." };
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.user) {
    return { error: "Correo o contraseña incorrectos." };
  }

  // La cuenta puede existir en Supabase Auth pero estar desactivada acá
  // (tabla `usuarios`, pantalla Usuarios) sin que Auth lo sepa — se
  // revisa para avisarle con un mensaje claro, en vez de dejarlo
  // rebotando en silencio entre "/" y "/login" (que es lo que haría el
  // Layout protegido de todos modos, por las dudas).
  const { data: fila } = await supabase
    .from("usuarios")
    .select("activo")
    .eq("id", data.user.id)
    .single();

  if (!fila?.activo) {
    await supabase.auth.signOut();
    return { error: "Tu usuario está desactivado. Consultá con el administrador." };
  }

  revalidatePath("/", "layout");
  redirect(redirectTo.startsWith("/") ? redirectTo : "/");
}

export async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
