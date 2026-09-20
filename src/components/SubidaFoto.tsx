"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Sube una foto directo al bucket público `fotos-recetas` desde el
 * navegador (la RLS de storage.objects solo deja escribir en la carpeta
 * de la sede del usuario) y después guarda la URL pública con la Server
 * Action que le pasen — `guardar` — para que quede en la base.
 */
export default function SubidaFoto({
  sedeId,
  tipo,
  itemId,
  fotoUrl,
  guardar,
}: {
  sedeId: string;
  tipo: "receta" | "subreceta";
  itemId: string;
  fotoUrl: string | null;
  guardar: (url: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  async function manejarArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    setError(null);
    setSubiendo(true);
    try {
      const supabase = createClient();
      const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
      const ruta = `${sedeId}/${tipo}/${itemId}-${Date.now()}.${ext}`;
      const { error: subidaError } = await supabase.storage
        .from("fotos-recetas")
        .upload(ruta, archivo, { upsert: true, contentType: archivo.type || undefined });
      if (subidaError) throw subidaError;
      const { data } = supabase.storage.from("fotos-recetas").getPublicUrl(ruta);
      startTransition(() => {
        guardar(data.publicUrl);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex items-center gap-3">
      {fotoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={fotoUrl} alt="" className="h-16 w-16 rounded-lg object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-slate-100 text-2xl">
          🍽️
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="btn-secondary w-fit cursor-pointer px-3 py-1.5 text-xs">
          {subiendo || pendiente ? "Subiendo..." : fotoUrl ? "Cambiar foto" : "Subir foto"}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={manejarArchivo}
            disabled={subiendo || pendiente}
          />
        </label>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  );
}
