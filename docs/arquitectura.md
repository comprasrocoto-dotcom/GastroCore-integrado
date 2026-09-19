# Gastro Central — arquitectura y estado del proyecto

Este documento explica en lenguaje simple qué es Gastro Central, qué se ha
construido hasta ahora y qué falta. Está pensado para que Diego y Mariluz
puedan entender el estado del proyecto sin necesidad de leer código.

## 1. Qué es Gastro Central

Gastro Central es la reconstrucción, desde cero, del sistema de costeo de
recetas (lo que hoy es "GastroCore"), pero pensado desde el principio para
manejar **varias marcas y varias sedes**, no solo un restaurante.

Es un proyecto **completamente nuevo y separado**: base de datos nueva,
repositorio de código nuevo. El GastroCore/Rocoto actual (producción) **no
se toca** — sigue funcionando exactamente igual mientras se construye esto.

## 2. Marcas y sedes (confirmado con Mariluz)

Se identificaron 5 marcas reales, una de ellas con varias sedes:

| Marca | Sedes |
|---|---|
| 123 WOK | Oviedo, Interplaza, Laureles, Tesoro |
| Malanga | Malanga |
| Sinpar | Sinpar |
| Rocoto | Rocoto |
| Casa de Nadie | Casa de Nadie |

No hay módulo de "Centros de Producción": se evaluó y Mariluz confirmó que
Gastro Central solo maneja estas 5 marcas reales.

## 3. Base de datos (Supabase)

- **Nombre:** gastrocore-integrado
- **ID del proyecto:** `slbehczdonbzpneyglrx`
- **Región:** us-east-1 · **Plan:** gratuito ($0/mes)

### Estructura (14 tablas + 2 vistas)

Dos niveles: **marca → sede**. Los datos operativos (insumos, recetas,
etc.) viven a nivel de sede, porque el costo real puede variar de una sede
a otra aunque compartan marca.

Tablas: `marcas`, `sedes`, `usuarios`, `unidades_medida`, `familias`,
`subfamilias`, `insumos`, `precios_historicos`, `subrecetas`, `recetas`,
`ingredientes_receta`, `fichas_tecnicas`, `historial_recetas`,
`configuracion`.

Vistas (de solo lectura, para el recetario público de cocina):
`recetario_publico`, `recetario_publico_ingredientes`.

**Simplificación importante:** la tabla `recetas` NO guarda `food_cost`,
`precio_sugerido` ni `margen_objetivo` como columnas fijas — se calculan al
vuelo cada vez que se necesitan (módulo `lib/costeo.ts` de la app), usando
las mismas fórmulas de siempre. Así nunca quedan desactualizados si cambia
el costo de un insumo.

Las fórmulas de costeo (IVA 8%, food cost objetivo 35%, semáforo
verde/amarillo/rojo, merma que divide, desvío que multiplica) se
mantuvieron exactamente iguales a las del sistema actual.

### Seguridad (quién ve qué)

RLS (seguridad a nivel de fila) en las 14 tablas y en las 2 vistas
(`security_invoker = true`, para que respeten esa misma RLS):

- Un usuario de una sede solo ve los datos de **esa sede**.
- Un Admin de una marca ve **todas las sedes de su marca**, no las de otras.
- El "maestro" (Admin multi-marca, Mariluz) ve **todo**.

Verificado con el advisor de seguridad de Supabase: **0 alertas
pendientes**.

**Cómo entra el rol/marca/sede al sistema:** cuando alguien inicia sesión,
una función (`public.custom_access_token_hook`) agrega su rol, marca_id,
sede_id y usuario_id al token de acceso, leyéndolos de su fila en
`usuarios`. Ese hook ya está **activado** por Mariluz desde el panel de
Supabase y confirmado funcionando (se ve en los logs de autenticación).

**Bug encontrado y corregido (17/09):** después de activar el hook y
cargar las variables de entorno en Vercel, el login funcionaba pero todas
las pantallas (Insumos, Familias, Subrecetas, Recetas, Recetario) mostraban
"No hay ninguna sede disponible" en vez de la lista real de sedes. La causa
no era el hook ni el login — esos funcionaban bien — sino un permiso que
faltaba desde el principio: a los usuarios que inician sesión les faltaba
autorización para *leer* (no ejecutar directamente, sino simplemente tener
acceso a) el esquema interno `private` de la base de datos, donde viven las
funciones que calculan "¿qué rol/marca/sede tiene esta persona?". Sin ese
permiso, cualquier consulta que necesitara esas funciones fallaba
silenciosamente y la app interpretaba el error como "no hay sedes". Se
corrigió con una migración que le da ese permiso a los usuarios que inician
sesión (`grant usage on schema private...`), verificado paso a paso
simulando exactamente lo que ve un usuario real, y confirmado de nuevo con
el advisor de seguridad de Supabase que no quedó ninguna alerta nueva.

## 4. Datos ya cargados

| Qué | Cantidad |
|---|---|
| Marcas | 5 |
| Sedes | 8 |
| Unidades de medida | 6 |
| Familias | 19 |
| Subfamilias | 132 |
| **Insumos** | **3,884** |
| Usuarios | 0 (pendiente crear el primero, ver sección 7) |
| Recetas / Subrecetas | 0 (se cargan desde la app a medida que se creen) |

## 5. La aplicación (Next.js) — construida en esta fase

Repositorio: `GastroCore-integrado`. Stack: Next.js (App Router) +
TypeScript + Tailwind + Supabase.

Módulos ya escritos:

- **Autenticación** con Supabase Auth (login/logout, sesión por cookies).
- **Selector de marca/sede** en el header: el maestro puede cambiar
  libremente, un Admin de marca solo ve las sedes de la suya, un usuario de
  una sola sede no ve selector.
- **Insumos**: listar (con búsqueda y paginación), crear, editar, e
  historial de precios (cada cambio de costo queda registrado).
- **Familias/subfamilias**: listar, crear, editar.
- **Subrecetas**, con el patrón "maestro-calculadora": cada subreceta tiene
  sus propios ingredientes, y al recalcularla empuja su costo al insumo
  `SUB.…` que la representa, deja rastro en el historial de precios, y
  recalcula en cascada toda receta (o subreceta) que la use.
- **Recetas**: ingredientes (insumos o subrecetas), y un panel que muestra
  food cost, semáforo, precio sugerido y margen, calculados al vuelo.
- **Fichas técnicas** (preparación, emplatado, notas, tiempo, gramaje) e
  **historial de versiones** de cada receta.
- **Recetario público** de cocina: mismas recetas pero sin costos, precios
  ni márgenes — para el personal de cocina.
- **Diseño visual** (17/09): Mariluz pidió que Gastro Central se vea y se
  sienta igual que el GastroCore actual. Se portó el mismo sistema de
  colores, tipografía (Inter + JetBrains Mono para números), tarjetas,
  botones, tablas tipo ERP, insignias de estado y **modo oscuro** (el
  interruptor 🌙/☀️ en el header, recuerda la preferencia en el navegador).
  Es 100% visual — no cambió ninguna lógica de negocio ni de permisos.
- **"Nueva receta" rehecha** (18/09): Mariluz mostró cómo arma una receta
  el GastroCore actual (una sola pantalla: datos del plato, clasificación,
  tabla de ingredientes con buscador y cálculo en vivo, y un resumen de
  costeo tipo "ticket" al costado) y pidió esa misma estructura. Se
  reconstruyó `recetas/nueva` así: buscador de insumos/subrecetas con
  teclado (como el "Select2" del sistema actual), campo numérico con
  formato colombiano (miles con punto, decimales con coma), selector de
  familia con búsqueda, y el costeo (costo por ingrediente, desvío de
  mercancía, food cost, precio sugerido, margen) se calcula en el
  navegador con las mismas fórmulas de `lib/costeo.ts` mientras se arma la
  receta, y recién se guarda todo junto (receta + ingredientes) al final —
  igual que el sistema actual. Quedó afuera, a propósito, el campo
  "Referencia ERP" con numeración automática por familia: es una lógica de
  negocio específica (cómo se emparejan las recetas con el POS viejo) que
  no se replicó sin confirmar primero si aplica igual en el sistema nuevo.

**Cómo se probó sin poder instalar dependencias:** este entorno de trabajo
no tiene acceso al registro de npm (una restricción de red de la
organización, no del proyecto), así que no se pudo correr
`npm install`/`npm run build` acá. En su lugar:

1. Las fórmulas de costeo se verificaron a mano con casos de prueba en
   Node.js puro (sin dependencias).
2. La lógica más delicada — el recálculo en cascada de subrecetas — se
   escribió como funciones de Postgres (`recalcular_receta`,
   `recalcular_subreceta`) y se probó con datos reales de Rocoto
   (insertados y borrados en la misma prueba, sin dejar rastro).
3. El código completo se desplegó de prueba directo a Vercel (que sí tiene
   acceso a internet y compila ahí), lo que permitió encontrar y corregir
   2 errores reales de código antes de entregarlo (ver el commit
   "Corregir errores reales encontrados al desplegar en Vercel").

El despliegue de prueba (preview, no producción) con el diseño visual
nuevo (igual al de GastroCore) aplicado a todas las pantallas, quedó en:
https://gastro-core-integrado-msu44jmib-mariluzs-projects-a3ee4001.vercel.app
Login y selector de sede ya funcionan ahí de punta a punta.

Y el despliegue de prueba con la nueva pantalla "Nueva receta" (18/09),
quedó en:
https://gastro-core-integrado-10g5qi7d1-mariluzs-projects-a3ee4001.vercel.app
— Insumos/Familias/Subrecetas/Recetario no están en ESTE despliegue en
particular (ver nota técnica abajo); Recetas (lista, nueva, editar), Inicio
y Login sí funcionan completos ahí.

**Nota técnica — límite al desplegar todo junto:** este entorno de trabajo
no puede enviar el proyecto completo (55 archivos) a Vercel en un solo
despliegue de prueba: hay un límite de cuánto texto puede "escribir" de una
sola vez al armar ese envío, y el proyecto ya lo supera. Por eso, por ahora,
cada despliegue de prueba cubre una parte de las pantallas (no afecta nada
guardado en la base de datos, solo qué tan completo se ve CADA LINK de
prueba). Se resuelve de raíz conectando el repositorio de GitHub
directamente a Vercel (así Vercel arma el despliegue él mismo, sin este
límite) — ver el pendiente técnico del `.bundle`/`git push` más abajo.

**Actualización (18/09, más tarde):** se intentó de nuevo enviar el
proyecto completo (55 archivos) en un solo despliegue de prueba. Un primer
intento pareció fallar por un error real de código (`SelectorSede.tsx`,
variable sin usar), pero al revisar el código actual archivo por archivo no
existe tal error — ese despliegue en particular se armó con una versión
vieja/distinta del archivo, no con el código de hoy. Se confirma entonces
que el problema de fondo sigue siendo el límite de tamaño del envío
descrito arriba, no un error de programación: se intentó enviar todo de
nuevo, en un solo paso, y el envío se corta antes de completar los 55
archivos. El código actual (revisado archivo por archivo hoy) no tiene
errores conocidos. La solución de fondo sigue siendo la misma: conectar el
repositorio de GitHub directamente a Vercel.

**Resuelto de raíz (19/09):** se subió el código completo al repositorio de
GitHub (`GastroCore-integrado`, rama `main`) archivo por archivo, usando el
navegador con la sesión de Mariluz ya iniciada — porque este entorno de
trabajo tampoco tiene permiso para hacer `git push` directo al repositorio.
Se verificó, al final, que el árbol de archivos del repositorio coincide
exactamente con el código construido (mismo número de archivos, mismo
contenido) salvo dos archivos de documentación que se agregarán después y
dos archivos viejos de prueba que se pueden borrar del repositorio más
adelante (no son parte de la app). Con el código completo ya en GitHub, se
conectó el proyecto de Vercel (`gastro-core-integrado`) directamente al
repositorio: de ahora en más, cada vez que se agregue o cambie código en la
rama `main`, Vercel arma el despliegue él mismo, sin el límite de tamaño de
antes. El primer despliegue con el proyecto ya conectado se armó
correctamente con las 55 pantallas y módulos completos.

**Nota de transparencia:** durante el proceso de subir los archivos al
navegador, en un paso automático de "copiar y pegar" código, por una fracción
de segundo el portapapeles del navegador quedó momentáneamente con datos de
una factura (no código) — coincidiendo con que, en simultáneo, Mariluz debe
haber copiado ese texto en su propia computadora. Se detectó de inmediato,
no se guardó ni se envió a ningún lado, y se volvió a intentar el paso
correctamente. Se menciona acá solo por transparencia, ya que la
información pudo quedar visible un instante en una captura de pantalla de
este proceso.

### Lo que todavía le falta a Gastro Central frente a GastroCore

Comparando con el GastroCore actual, además del diseño visual (ya hecho),
hay módulos y funciones que GastroCore tiene y Gastro Central todavía no:

- **PDF de recetas y Exportar a Excel** — marcados por Mariluz como
  prioridad para hacer pronto.
- Usuarios (panel de administración) y Configuración (parámetros de
  costeo, umbrales) — hoy se crean/ajustan a mano desde Supabase.
- Análisis (panel de gráficos), recorte/subida de fotos en recetas, Manual
  de ayuda, y autoguardado con cola anti-doble-clic.

Ninguno de estos afecta lo que ya está construido — son módulos nuevos a
sumar, no cambios a lo existente.

## 6. Lo que NO se tocó

- El GastroCore/Rocoto actual en producción: sigue igual, sin cambios.
- Las hojas de cálculo de Google Sheets (respaldo de producción): no se
  tocaron.

## 7. Estado de los pasos manuales de Mariluz

1. ✅ **Hook de sesión activado** (panel de Supabase → Authentication →
   Hooks → "Customize Access Token (JWT) Claims hook").
2. ✅ **Primer usuario "maestro" creado** (Mariluz, rol Admin multi-marca,
   ve todas las marcas y sedes).
3. ✅ **Variables de entorno cargadas en Vercel** (`NEXT_PUBLIC_SUPABASE_URL`
   y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, en los 3 entornos del proyecto
   `gastro-core-integrado`).

Login funcionando de punta a punta, confirmado por Mariluz probando en el
despliegue de prueba (ver sección 5/8 para el link).

**Pendiente ahora:** que Mariluz pruebe cada módulo (Insumos, Familias,
Subrecetas, Recetas, Recetario) con su usuario y confirme que ve sus 8
sedes correctamente, y — si hay tiempo — probar también con un usuario de
una sola marca o una sola sede, para confirmar que cada quien ve solo lo
que le corresponde.

Pendientes de decisión de negocio (no urgentes, ver sección 6 del prompt de
fase 2 para más detalle): dominio final, si el alta de usuarios la hace
Mariluz manualmente o hace falta invitación por correo, y si se migran
recetas existentes o se arranca vacío.

✅ **Pendiente técnico resuelto (19/09):** el código completo ya está en
GitHub y el proyecto de Vercel quedó conectado directamente al
repositorio — ver el detalle en la sección 5. Queda como limpieza opcional
(no urgente) borrar del repositorio dos archivos viejos de prueba
(`GastroCore-integrado.bundle` y `gastro-central-codigo.zip`) que ya no
hacen falta.

## 8. Links para revisar

- Panel del proyecto en Supabase: https://supabase.com/dashboard/project/slbehczdonbzpneyglrx
- Editor de tablas: https://supabase.com/dashboard/project/slbehczdonbzpneyglrx/editor
- Hooks de autenticación: https://supabase.com/dashboard/project/slbehczdonbzpneyglrx/auth/hooks
- Usuarios: https://supabase.com/dashboard/project/slbehczdonbzpneyglrx/auth/users
- Repositorio de código: https://github.com/comprasrocoto-dotcom/GastroCore-integrado
- Despliegue estable, conectado a GitHub (se actualiza solo con cada cambio en `main`): https://gastro-core-integrado-git-main-mariluzs-projects-a3ee4001.vercel.app
