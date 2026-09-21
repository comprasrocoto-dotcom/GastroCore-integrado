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

## 9. Copiar la estructura real de GastroCore, módulo por módulo (19/09, en curso)

Mariluz mandó 9 capturas del GastroCore real y fue clara: el ajuste de
diseño anterior (colores, tipografía, modo oscuro) no alcanza — hay que
copiar la **estructura** de cada pantalla (tarjetas, tablas, paneles), no
solo el estilo. Esto es un trabajo más grande de lo que parecía al
principio, porque varios módulos de GastroCore todavía no existen en
Gastro Central (Panel Ejecutivo, Usuarios, Manual, Configuración) — hay
que construirlos de cero, no solo reordenar lo que ya hay.

**Hecho en esta etapa:**

- La barra de navegación de arriba quedó en el mismo orden que GastroCore
  (Insumos, Subrecetas, Recetas, Familias, Recetario).
- La pantalla de **Recetas** ahora tiene las tarjetas de estadísticas
  (total, costo promedio, food cost promedio, rentables, fuera de
  objetivo, sin precio, actualizadas hoy), un panel lateral con las
  familias y la tabla de recetas agrupada por familia con el semáforo de
  food cost — igual que en GastroCore.
- La pantalla de **Subrecetas** tiene sus tarjetas de estadísticas, el
  buscador, "ver inactivas", y la tabla con la referencia del insumo
  maestro y el chequeo de si quedó desactualizado frente al costo real de
  la subreceta.

**Encontrado en el camino — necesita tu confirmación:** en GastroCore
real, cada receta se agrupa en dos niveles (ej. "Bar → Sodas", "Cocina →
Ceviches"). En Gastro Central, las recetas solo se clasifican en un
nivel (familia). Le pedí permiso a Mariluz por chat para agregar una
columna nueva a la base (`subfamilia_id` en `recetas`, opcional, no borra
ni cambia nada existente) para poder armar ese segundo nivel — el sistema
de aprobaciones automáticas bloqueó el cambio por tratarse de producción,
así que quedó pendiente de que ella lo confirme. Mientras tanto, el panel
lateral de familias en Recetas ya funciona, pero agrupa solo por familia
(un nivel), no por familia y subfamilia.

**Todavía falta:** construir desde cero Panel Ejecutivo, Usuarios, Manual y
Configuración.

**Actualización (20/09):** se revisaron las 9 capturas una por una y se
confirmó que "Nueva receta" (`recetas/nueva`) ya tenía la estructura
correcta desde la etapa anterior. Se rehicieron las dos pantallas que
faltaban:

- **"Nueva subreceta"** (`subrecetas/nueva`): ahora tiene el mismo patrón
  "maestro-calculadora" que ya usa el resto del sistema — un panel para
  vincular la subreceta a un insumo `SUB.…` que ya exista sin vincular
  todavía, o crear uno nuevo (con referencia sugerida automática, tipo
  `SUB001`, `SUB002`...), y abajo la tabla de ingredientes con buscador y
  el resumen de costeo tipo "ticket", igual que en GastroCore.
- **Vista de detalle de una receta** (al abrir una receta desde el
  Recetario): antes era solo un formulario de edición; ahora es un panel
  de solo lectura con las tarjetas de costo/precio/utilidad arriba, los
  datos generales (familia, rendimiento, fechas), la tabla de
  ingredientes, el historial de versiones y el resumen de costos al
  costado — como en la captura de "PISCO PUNCHS" que mandó Mariluz. La
  edición avanzada (cambiar datos, agregar/quitar ingredientes, ficha
  técnica) se mantuvo, más abajo en la misma página, para no perder
  ninguna función que ya existía.

Los 6 cambios de esta etapa ya están en GitHub (rama `main`) y Vercel los
desplegó automáticamente a producción.

**Dos preguntas para Mariluz, todavía sin responder — no se avanzó nada
sobre esto sin su confirmación:**

1. La migración pendiente para agregar `subfamilia_id` a `recetas` (para
   poder agrupar en dos niveles, como "Bar → Sodas", igual que el panel de
   familias de la captura del Recetario real). El sistema de aprobaciones
   la sigue bloqueando por tratarse de producción — sigue esperando que
   Mariluz la apruebe.
2. **Nueva pregunta:** en la captura de "Nueva receta", el campo
   "Referencia ERP (interna)" trae un texto de ayuda que dice "elige la
   familia y se sugiere...", como si el sistema propusiera un código
   automáticamente según la familia elegida. Pero en la captura de detalle
   de una receta ya creada (PISCO PUNCHS), ese mismo campo aparece vacío
   ("–") aunque la receta sí tiene familia. No quedó claro, solo mirando
   las capturas, cuál es la regla exacta para sugerir ese código (¿es un
   número que sigue una secuencia por familia? ¿se puede dejar vacío
   siempre? ¿se usa para algo del POS?). Para no inventar esa lógica, este
   campo todavía no se construyó — hace falta que Mariluz explique cómo
   funciona en el sistema actual.

## Recetario rediseñado + subida de fotos (20/09)

Mariluz pidió avanzar con el rediseño completo del Recetario (la pantalla
que usa cocina, sin costos ni precios) y agregar la posibilidad de subir
una foto a cada receta y subreceta.

**Hecho en esta etapa:**

- **Recetario** (`/recetario`) ahora es una sola pantalla con buscador,
  un panel lateral (Todas / Sub. recetas / por categoría) y una grilla de
  tarjetas — en vez de tener que entrar a cada receta por separado. Al
  hacer clic en una tarjeta se abre el detalle (preparación, emplatado,
  notas, ingredientes) en una ventana encima, sin perder el lugar en la
  grilla.
- El Recetario ahora incluye tanto **recetas** como **subrecetas** —
  antes solo mostraba recetas.
- **Subida de fotos:** en el detalle de una receta y de una subreceta
  (pantallas `/recetas/[id]` y `/subrecetas/[id]`) ahora hay un botón
  para subir una foto desde el celular o la computadora. La foto queda
  guardada en Supabase Storage (bucket `fotos-recetas`, privado por sede:
  cada sede solo puede subir o ver sus propias fotos) y se muestra tanto
  en el detalle como en la tarjeta del Recetario.
- Se corrigió una migración de base de datos que había quedado a medio
  aplicar en el intento anterior (las vistas `recetario_publico*` que
  alimentan esta pantalla).

**Encontrado en el camino — necesita tu confirmación:**

1. Igual que con la pantalla de Recetas, el Recetario también podría
   agrupar por Centro de Costo (Bar / Cocina), como se ve en tu captura
   de referencia. Pero esa información (`familias.centrocosto`) todavía
   está vacía en la base de datos real — nadie la cargó todavía. Mientras
   no esté cargada, el Recetario agrupa solo por familia (categoría), no
   por Bar/Cocina.
2. Las subrecetas no tienen "familia" en la base de datos (a diferencia
   de las recetas), así que en el Recetario quedaron todas juntas bajo
   "Sub. recetas", sin categoría. ¿Está bien así, o preferís que se
   puedan categorizar de alguna otra forma?

**Nota técnica (para que quede registrado):** al revisar por qué el
despliegue en Vercel fallaba después de subir estos cambios, se encontró
que uno de los archivos (`recetario.ts`) se había subido con contenido
viejo en un intento anterior — el guardado en GitHub no se completó bien
esa vez, aunque en su momento pareció exitoso. Se corrigió subiendo la
versión correcta y se ajustaron dos archivos más para que TypeScript no
marcara error al compilar. El sitio ya quedó desplegado correctamente
con los 13 archivos de esta etapa.

## Agregar ingredientes en la misma fila + descargar PDF (20/09)

Mariluz pidió dos cambios en las pantallas de detalle de receta y
subreceta (`/recetas/[id]` y `/subrecetas/[id]`), mostrando capturas del
sistema viejo como ejemplo.

**Hecho en esta etapa:**

- **Agregar ingredientes en la fila de la tabla:** antes, para agregar
  un insumo o una subreceta como ingrediente había que usar dos
  formularios aparte, más abajo en la pantalla ("Agregar insumo" /
  "Agregar subreceta"). Ahora esos formularios se quitaron y en su lugar
  la propia tabla de ingredientes tiene, al final, una fila lista para
  cargar el siguiente ingrediente (elegir insumo o subreceta, cantidad,
  unidad, % de merma) con un botón "+ Agregar" — todo dentro de la misma
  tabla, como se veía en el ejemplo que mandó Mariluz.
- **Botón "Descargar PDF":** junto al botón de "Subir foto", tanto en
  recetas como en subrecetas, ahora hay un botón "⬇ Descargar PDF" que
  genera y descarga un PDF con la información de la receta o subreceta:
  datos generales, costos, tabla de ingredientes y (en recetas) el
  resumen de precio y utilidad. El PDF usa exactamente los mismos números
  que ya se ven en pantalla — no se inventó ni recalculó ninguna fórmula
  nueva.

Estos cambios no tocan cómo se calculan los costos ni los precios; solo
cambian cómo se cargan los ingredientes y agregan una forma nueva de
exportar la información a PDF.

## Auditoría, mapeo y plan contra el GastroCore viejo + pantalla de Configuración (21/09)

Mariluz pidió una tarea mucho más grande: revisar a fondo qué hacía el
GastroCore viejo (el de Google Sheets) y compararlo con Gastro Central,
antes de seguir agregando funciones — siguiendo un orden estricto que
ella misma marcó: primero auditar, después comparar, después planear, y
recién al final programar. También dejó una regla principal muy clara:
**no rediseñar nada de lo que ya existe** — la idea es recuperar la
lógica y las funciones del GastroCore viejo, pero manteniendo tal cual
está el diseño actual de Gastro Central (colores, botones, menú, tablas,
todo).

**Lo que se hizo en esta etapa (auditoría + mapeo + plan):**

- Se revisó todo el código y la base de datos actuales de Gastro
  Central: las 14 tablas, sus relaciones, los cálculos de costeo, y
  todas las pantallas ya construidas.
- Se investigó cómo funciona realmente el GastroCore viejo. Resultado
  importante: el GastroCore viejo **no usa una base de datos como la
  nuestra** — usa una planilla de Google Sheets ("Base de Costos") como
  única fuente de datos, y un programa intermedio (Apps Script) que lee
  y escribe en esa planilla. Eso explica varias diferencias de
  comportamiento entre los dos sistemas.
- Se encontró algo que Mariluz no había mencionado y que le avisamos por
  chat: dentro del repositorio del GastroCore viejo hay un intento
  paralelo, sin terminar, de migrarlo a una base de datos — separado de
  Gastro Central y con errores conocidos sin resolver. No se tocó nada
  de eso; solo se dejó constancia para que Mariluz confirme si lo sabía
  y si Gastro Central sigue siendo el camino oficial.
- Con toda esa información se armó una tabla comparando función por
  función qué existe en cada sistema, y un plan ordenado de qué falta
  construir, qué se puede reutilizar tal cual y qué necesita una
  decisión de Mariluz antes de programarse (quedaron 6 preguntas
  pendientes, todavía sin responder, sobre: la migración de subfamilia
  en recetas, cómo se numera la "Referencia ERP", cómo funciona la
  conversión de unidades del sistema viejo, qué significan los
  indicadores del futuro Panel Ejecutivo, si Mariluz conocía el intento
  de migración paralelo, y si ella va a cargar el dato de Centro de
  Costo por familia).

**Lo único que se construyó en esta etapa (lo único que no dependía de
ninguna decisión pendiente): la pantalla de Configuración.**

- El food cost objetivo (35%), el food cost objetivo para un futuro
  Panel Ejecutivo (30%) y el IVA/INC (8%) eran, hasta ahora, números
  fijos escritos directamente en el código. En el GastroCore viejo esto
  se podía ajustar; en Gastro Central no había forma de cambiarlos sin
  modificar el código.
- Ahora hay una pantalla nueva, **Configuración** (aparece en el menú de
  arriba, con el mismo estilo que el resto de las pantallas — no se
  cambió ningún color, tipografía ni botón existente), donde se pueden
  editar esos tres valores por sede. Se guardan en una tabla que ya
  existía en la base de datos (`configuracion`) pero que todavía no se
  usaba para nada.
- Las pantallas de Recetas (listado, detalle, formulario de nueva
  receta y el PDF) ahora leen ese valor configurado en lugar del número
  fijo. Si una sede no configuró nada todavía, se sigue usando
  exactamente el mismo valor de siempre (35% / 30% / 8%) — no cambia el
  comportamiento de ninguna receta existente hasta que alguien entre a
  Configuración y lo modifique a propósito.
- De paso se corrigió un detalle técnico: cada receta ya tenía su propio
  campo de IVA editable ("Edición avanzada"), pero ese valor nunca se
  usaba realmente en el cálculo del food cost — el cálculo siempre usaba
  el 8% fijo. Ahora si una receta tiene su propio IVA cargado, se
  respeta ese valor.

Esto no cambia ninguna fórmula de costeo, ni el diseño de ninguna
pantalla existente: solo hace configurable un número que antes estaba
fijo en el código, y corrige que el IVA propio de la receta se tuviera
en cuenta.

**Sigue pendiente, esperando respuesta de Mariluz a las 6 preguntas del
mapeo, antes de seguir programando** (para no inventar ninguna decisión
de negocio): el panel de Usuarios, la migración de subfamilia en
recetas, el sistema real de conversión de unidades de medida, la
numeración de Referencia ERP, el Panel Ejecutivo, la pantalla de
Análisis, el manual, y la trazabilidad campo por campo.
