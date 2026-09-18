# Gastro Central (GastroCore-integrado)

Sistema de costeo de recetas multi-marca y multi-sede. Reconstrucción completamente
nueva y separada del GastroCore/Rocoto actual (que sigue en producción sin cambios).

Ver `docs/arquitectura.md` para una explicación en lenguaje simple del proyecto y su
estado, y `docs/prompt-maestro-hermes-fase-2-lanzar-app.md` para el detalle completo
de esta fase (construir y publicar la aplicación).

## Empezar en local

```bash
npm install
cp .env.example .env.local   # completar con los valores reales
npm run dev
```

Abrir http://localhost:3000

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Supabase (Postgres + Auth + RLS) — proyecto `slbehczdonbzpneyglrx`

## Variables de entorno

Ver `.env.example`. Nunca comitear `.env.local` ni ninguna clave real.
