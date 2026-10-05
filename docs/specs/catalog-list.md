# Feature Implementation Spec: Listado de catálogo

## Source Feature

- `id`: `catalog-list`
- `area`: `catalog`
- `depends_on`: `["bootstrap-seed"]` (satisfecho; `bootstrap-seed` en `accepted`)
- `status`: `not_started`
- `source`: `feature_list.json`

## Goal

Que el usuario vea, al abrir la app, una cuadrícula responsive con los productos del seed: cada tarjeta muestra imagen, nombre, categoría y precio, en 1–2 columnas en móvil y 3–4 en escritorio, con la dirección visual de `DESIGN.md` (grid de 12 columnas, tarjetas de producto). La home (`/`) pasa a ser el listado del catálogo, servida desde la base real (`prisma/*.db` vía Prisma). Este slice además introduce la capa de acceso a datos (`src/lib`), de la que dependerán `catalog-filter`, `catalog-sort` y `product-detail`.

## Non-Goals

- Filtros (categoría, talla, color, precio) ni ordenación interactiva: son `catalog-filter` y `catalog-sort`. El único orden es el por defecto (más nuevo primero).
- Detalle de producto ni enlaces a ficha: `product-detail`. Las tarjetas **no** navegan en este slice (evitar enlaces muertos a una ruta inexistente).
- Tallas disponibles, badges de stock/"Novedad"/"IA" y estados de variante en la tarjeta (el alcance son solo imagen, nombre, categoría y precio).
- Paginación, scroll infinito o "cargar más" (el seed tiene 8 productos).
- Header completo (carrito, cuenta, chatbot), widget de chatbot, carrito y checkout.
- API routes, server actions ni mutations: la página lee la base en el server component.
- Cambios de esquema, migraciones ni seed (salvo que un bloqueo lo exija; no se anticipa).
- Introducir un harness E2E (ver Verification Plan: justificado).
- Tailwind u otros frameworks CSS: se estila con CSS Modules + custom properties de `DESIGN.md`.
- Panel de administración, datos reales de producto, despliegue/CI remoto.

## Job Story

When entro en la tienda sin saber qué hay a la venta,
I want ver de un vistazo los productos del catálogo con su imagen, nombre, categoría y precio en una cuadrícula que se adapte a mi pantalla,
so I can explorar la oferta y decidir qué me interesa.

## Users And Permissions

- **Invitado (Guest)**: actor principal. Navega el listado sin cuenta, en cualquier viewport. Sin control de acceso en este feature (todo el catálogo es público).
- **Desarrollador/agente**: ejecuta `./init.sh` y `pnpm dev`; añade tests y docs.

## Acceptance Scenarios

### Scenario 1: La home lista los productos del seed

Given una base poblada por el seed (`pnpm db:setup`: 8 productos, 3 categorías)
When el usuario abre `/`
Then ve una tarjeta por producto (8) con imagen, nombre, categoría y precio; por ejemplo "Camiseta básica" con categoría "Camisetas" y precio "19,99 €".

### Scenario 2: La cuadrícula es responsive

Given el listado del catálogo renderizado
When el usuario estrecha o ensancha la ventana
Then la cuadrícula usa 2 columnas en móvil (<640px), 3 en tableta (640–1023px) y 4 en escritorio (≥1024px), sin desbordes ni scroll horizontal.

### Scenario 3: Formato de precio y datos correctos

Given los productos con `priceCents` enteros en la base (1999–11999)
When se renderiza cada tarjeta
Then el precio se muestra formateado en euros con locale es-ES ("19,99 €", "119,99 €") y el nombre y la categoría coinciden con los del seed.

### Scenario 4: Catálogo vacío con estado amigable

Given una base sin productos (o una consulta que devuelve 0)
When el usuario abre `/`
Then ve un estado vacío amigable (p. ej. "No hay productos disponibles en este momento.") en vez de una cuadrícula vacía o un error.

### Scenario 5: Verificación automatizada del listado

Given el repo con el listado implementado
When el desarrollador ejecuta `pnpm test`
Then hay tests que verifican (a) la consulta del catálogo sobre una base temporal sembrada devuelve los 8 productos con nombre, imagen, categoría y precio y orden por novedad, y (b) la cuadrícula renderiza esos campos (y el estado vacío); `pnpm test` termina en verde.

## Repository Research

### Files Inspected

- `feature_list.json` — alcance: "cuadrícula responsive … imagen, nombre, categoría y precio"; verificación: listado del seed + responsive 1–2 móvil / 3–4 escritorio; notas: referencia visual `DESIGN.md`; sin filtros ni ordenación.
- `PROGRESS.md` — base en verde (`./init.sh` exit 0, 2026-10-05); siguiente feature `catalog-list`; sin bloqueadores.
- `src/app/page.tsx` — home mínima de arranque (`<h1>Tienda de ropa</h1>` + párrafo); **sin datos ni catálogo**.
- `src/app/layout.tsx` — layout raíz (`lang="es"`, metadata "Tienda de ropa"); **sin CSS global importado** (no hay ningún stylesheet hoy).
- `src/app/page.test.tsx` — humo actual: render síncrono de `Home` y aserción del h1; se verá afectado por el cambio de la home (ver Expected File Changes).
- `package.json` — scripts `dev/build/start/lint/typecheck/test` (+ `postinstall`/`db:seed`/`db:setup`); **sin `test:e2e`**; deps: next 15, react 19, `@prisma/client` 6; devDeps: vitest 3 + Testing Library + jsdom.
- `vitest.config.ts` — entorno global `jsdom`, setup `vitest.setup.ts`; los tests `node` se marcan por archivo (`prisma/seed.test.ts` usa `// @vitest-environment node`).
- `prisma/schema.prisma` — modelos `Product(slug, name, description, imageUrl, priceCents, currency, categoryId, createdAt)` y `Category(slug, name)`; dinero en centavos (`Int`).
- `prisma/seed.ts` — 8 productos (slugs `camiseta-basica` … `abrigo-invierno`), 3 categorías (`camisetas`, `pantalones`, `abrigos`), `imageUrl = "/images/products/<slug>.svg"`, `createdAt` escalonado (~1/semana, el índice 0 es el más nuevo), `priceCents` 1999–11999; exporta `seedCatalog(prisma)`.
- `prisma/seed.test.ts` — patrón de test de integración a seguir: base temporal `file:./test-seed.db` bajo `prisma/`, `prisma migrate deploy` con `DATABASE_URL` sobrescrito (env del proceso y del `execSync`), `seedCatalog`, limpieza al final.
- `public/images/products/*.svg` (8) — placeholders locales servidos por Next desde `public/`.
- `.env` / `.env.example` — **hallazgo**: `.env` de este worktree usa `DATABASE_URL="file:./dev-catalog-list.db"` (y `PORT=3000`), no `dev.db` como en `.env.example`. El código nunca debe asumir el nombre del fichero de base: siempre `env("DATABASE_URL")` vía Prisma.
- `init.sh` — gate: install → asegurar `.env` → `pnpm db:setup` → lint → typecheck → test → build; sin dev servers.
- `ARCHITECTURE.md` — la capa 2 ("Lógica de dominio / servicios") está declarada como "se añadirá en features posteriores (`catalog-list` en adelante)"; la capa `src/lib/db` queda delegada a esta feature (confirmado también en los non-goals de `docs/specs/bootstrap-seed.md`).
- `CONSTRAINTS.md` — reglas durables vigentes (pnpm, SQLite local, migraciones commiteadas, seed idempotente, dinero en centavos, estados como String, `init.sh` sin dev servers, gate completo).
- `DESIGN.md` — tokens (colores, tipografía Inter/system, spacing 8/16/24, radios 6/10), layout (grid 12 col., catálogo = grid de tarjetas responsive 2–4 columnas), componente "Card producto: imagen + nombre + categoría + precio + tallas" (tallas fuera de alcance aquí), Responsive Baseline (móvil 1–2 col., tableta 2–3, escritorio 3–4), Accessibility Baseline (`alt` descriptivo, semántica HTML).
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md` — glosario (Producto/Categoría/Catálogo), objetivo "mostrar el catálogo con listado", escenario "catálogo filtrado/ordenado" reservado a features siguientes.
- `docs/specs/bootstrap-stack.md`, `docs/specs/bootstrap-seed.md` — formato de spec a seguir y delegaciones explícitas a esta feature (`src/lib`, cobertura E2E "a partir de `catalog-list`" — revisada aquí, ver Verification Plan).

Nota: no existen `playwright.config.*` ni ningún harness E2E (`pnpm test:e2e` no existe). No existen `docs/mvp-scope.md`, `docs/product-brief.md`, `docs/user-and-access-model.md` ni `docs/adr/*`. No hay CSS en el repo (ni globals ni modules) y no hay `src/components/` ni `src/lib/`.

### Existing Patterns To Follow

- Server Components de Next.js App Router en `src/app` (la home ya es un componente servidor sin "use client"; este feature no necesita client components).
- Prisma 6 + SQLite; cliente tipado generado en `postinstall`; dinero en **centavos** (`priceCents`); nunca tocar la base a mano.
- Tests Vitest colocados junto al código (`*.test.ts(x)`); integración contra base temporal con el patrón de `prisma/seed.test.ts` (marcado `// @vitest-environment node`).
- UI en español; docs y comentarios en español; verificación estándar vía `./init.sh` (gate no bloqueante, sin dev servers).

### Current Gaps

- Sin capa de acceso a datos (`src/lib/` no existe): hay que crear el singleton de Prisma y la consulta del catálogo.
- La home no lee datos ni muestra productos; sin componentes de tarjeta/cuadrícula; sin CSS (ni tokens de `DESIGN.md` aplicados).
- Sin tests de UI de catálogo ni de la consulta de listado.
- Sin harness E2E persistente (asentado desde `bootstrap-stack`; decisión aquí: no introducirlo en este slice, ver Verification Plan).

## Technical Approach

1. **Capa de datos** (introduce `src/lib`, delegada por `bootstrap-seed`):
   - `src/lib/db.ts` — singleton `PrismaClient` (guard en `globalThis` para no saturar instancias con el HMR de `next dev`). Sin lógica de negocio.
   - `src/lib/catalog.ts` — `getCatalogProducts(): Promise<CatalogProduct[]>` con `prisma.product.findMany({ include: { category: true }, orderBy: { createdAt: "desc" } })`. El tipo `CatalogProduct` expone solo lo que la UI necesita (`slug`, `name`, `imageUrl`, `priceCents`, `currency`, `category: { slug, name }`, `createdAt`). Orden por defecto determinista = novedad (más nuevo primero, coherente con el `createdAt` escalonado del seed); la ordenación por usuario es `catalog-sort`. **Sin filtros ni paginación** (alcance de features siguientes; la firma se mantiene estable para extenderla).
2. **Render**: `src/app/page.tsx` pasa a `async function` (Server Component) que llama `getCatalogProducts()` y compone la cuadrícula. Marcar la ruta con `export const dynamic = "force-dynamic"`: el listado refleja el estado de la base en cada petición y `pnpm build` no necesita base poblada (hoy `init.sh` siembra antes de buildear, pero el build no debe depender de ello). Sin API routes.
3. **Presentación** (server components puros, sin "use client"):
   - `src/components/ProductCard.tsx` — tarjeta: imagen + nombre + categoría + precio. Imagen con `next/image` y **`unoptimized`** (los placeholders son SVG locales; el optimizador de imágenes no procesa SVG sin `dangerouslyAllowSVG`, y forzar el optimizador rompería las imágenes), `alt` = nombre del producto, contenedor con aspect-ratio 3/4 y `object-fit: cover`. Nombre en `h2`, categoría en texto muted (`textMuted`), precio destacado formateado. **Sin enlaces** (sin `<a>`/`<Link>`: `product-detail` creará la navegación) y sin tallas ni badges.
   - `src/components/ProductGrid.tsx` — `<ul>` de tarjetas con CSS Module propio (`ProductGrid.module.css`). Cuadrícula: `display: grid; gap: spacing.md/l; grid-template-columns: repeat(2, 1fr)` base (<640px), `repeat(3, 1fr)` ≥640px, `repeat(4, 1fr)` ≥1024px → cumple "1–2 móvil, 3–4 escritorio" (2/3/4) y el Responsive Baseline de `DESIGN.md`. Si la lista viene vacía, renderiza el estado vacío amigable ("No hay productos disponibles en este momento.") en lugar del `<ul>`.
   - `src/lib/format.ts` — `formatPriceCents(priceCents, currency = "EUR")` con `Intl.NumberFormat("es-ES", { style: "currency", currency })` sobre `priceCents / 100` (p. ej. 1999 → "19,99 €"). Único punto de formateo de dinero en UI.
4. **Estilos** (sin Tailwind): `src/app/globals.css` con las custom properties de `DESIGN.md` (`--color-primary: #111827`, `--color-accent: #D97706`, `--color-surface: #F3F4F6`, `--color-text-muted: #6B7280`, `--color-border` sutil, spacing 8/16/24, radios 6/10px, `font-family: Inter, system-ui, -apple-system, "Segoe UI", sans-serif` — **sin descargar la fuente** (fallback de sistema; la app debe funcionar sin red) + base tipográfica (`h1` 28px/700, `h2` 20px/600, body 16px/400). Importar `globals.css` desde `src/app/layout.tsx`. Tarjetas: fondo superficie o blanco con borde sutil, radio 10px, sin sombras marcadas (Shapes de `DESIGN.md`). Semántica accesible (`<main>`, `<ul>/<li>`, jerarquía de headings) y foco visible si hubiera controles interactivos (no los hay en este slice).
5. **Home**: `src/app/page.tsx` renderiza `<main>` con `<h1>Catálogo</h1>` (h1 de la página según `DESIGN.md`) y el grid; el título de pestaña ("Tienda de ropa") se mantiene en el layout. El test de humo `src/app/page.test.tsx` se adapta al nuevo contenido (ver Expected File Changes).
6. **Tests** (Vitest):
   - `src/lib/catalog.test.ts` (`// @vitest-environment node`, patrón de `prisma/seed.test.ts`): base temporal `file:./test-catalog.db` bajo `prisma/`, `pnpm exec prisma migrate deploy` con `DATABASE_URL` sobrescrito, `seedCatalog`, y asserts sobre `getCatalogProducts()`: devuelve 8 productos; cada uno con `name` no vacío, `imageUrl` que casa `^/images/products/.+\.svg$`, `category.name` ∈ {Camisetas, Pantalones, Abrigos} y `priceCents` 1999–11999; el primero es `camiseta-basica` (orden por `createdAt` desc). Limpieza de la base temporal en `afterAll`.
   - `src/components/ProductGrid.test.tsx` (jsdom): con fixtures, renderiza una tarjeta por producto con nombre, categoría, precio formateado ("19,99 €") e `img` cuyo `alt` es el nombre; con `[]` muestra el estado vacío.
   - `src/app/page.test.tsx` (modificado, jsdom): `vi.mock` de `src/lib/catalog`, `render(await Home())` → h1 "Catálogo" + nombres de producto visibles (humo de composición página→grid).
7. **Cierre**: gate completo (`./init.sh`), comprobación manual responsive con `pnpm dev`, docs durables y evidencia.

## Expected File Changes

- `src/lib/db.ts` — create; singleton `PrismaClient`.
- `src/lib/catalog.ts` — create; `getCatalogProducts()` + tipo `CatalogProduct`.
- `src/lib/format.ts` — create; `formatPriceCents()`.
- `src/lib/catalog.test.ts` — create; integración sobre base temporal (`file:./test-catalog.db`, cubierta por `.gitignore`).
- `src/components/ProductCard.tsx` — create; tarjeta (imagen, nombre, categoría, precio).
- `src/components/ProductGrid.tsx` + `src/components/ProductGrid.module.css` — create; cuadrícula responsive + estado vacío.
- `src/components/ProductGrid.test.tsx` — create; tests de render de la cuadrícula.
- `src/app/globals.css` — create; tokens de `DESIGN.md` + estilos base.
- `src/app/layout.tsx` — modify; importar `globals.css` (sin otros cambios).
- `src/app/page.tsx` — modify; home → listado del catálogo (async server component, `force-dynamic`, h1 "Catálogo").
- `src/app/page.test.tsx` — modify; humo adaptado al nuevo h1 y contenido (cambio de alcance esperado, no churn ajeno).
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — update (ver Durable Documentation Impact).
- `feature_list.json`, `PROGRESS.md` — update (evidencia al cerrar la sesión).
- `prisma/*`, `init.sh`, `package.json`, `public/images/products/*`, `AGENTS.md`, `.gitignore` — not needed (sin cambios de esquema/seed/gate; `.gitignore` ya cubre `*.db*`).

## Visual Design Impact

- UI involved: **sí** (primera pantalla de producto real de la app).
- Design source: `DESIGN.md` (tokens de frontmatter + Layout/Components/Shapes/Responsive/Accessibility Baseline). Sin assets de diseño externos.
- Screens or states affected: **Listado/Catálogo** (la home `/`): grid de tarjetas; estado vacío del catálogo. Sin filtros/sidebar (aún), sin header completo, sin estados de carga (server render) ni de error del proveedor.
- Feature-specific visual states a manejar: (1) grid poblado; (2) estado vacío amigable. La variante "Agotada" **no** se marca en la tarjeta (fuera de alcance; `product-detail`).
- New design artifact required: **no** — `DESIGN.md` cubre la tarjeta y el grid; no hay conceptos generados pendientes.

## Durable Documentation Impact

- `ARCHITECTURE.md`: **update** — la capa 2 deja de estar "pendiente": documentar `src/lib/` (`db.ts` singleton, `catalog.ts` consultas de lectura, `format.ts`), que la home es el listado del catálogo (server component, `force-dynamic`), y la decisión de estilos (CSS Modules + custom properties de `DESIGN.md`; **sin Tailwind**; imágenes con `next/image unoptimized` por los SVG placeholder).
- `CONSTRAINTS.md`: **update** — añadir MUST: el dinero en UI se formatea desde centavos con `Intl.NumberFormat("es-ES")` en `src/lib/format.ts` (nunca concatenar a mano ni mutar `priceCents`); la UI se estila con CSS Modules + tokens de `DESIGN.md` (sin frameworks CSS nuevos sin decisión registrada); las páginas que leen la base se renderizan en modo dinámico (sin prerender estático de datos de la DB). Mantener intactos los MUST/MUST NOT existentes (gate, `init.sh` sin dev servers, migraciones, centavos).
- `AGENTS.md`: **not needed** — ni el flujo de arranque ni la ruta estándar de verificación cambian (el gate sigue siendo install + db:setup + lint + typecheck + test + build).
- `DESIGN.md`, `docs/domain-model.md`, `docs/build-brief.md`, `CONTEXT.md`: **not needed** — son la fuente de verdad de este alcance y la implementación no los contradice (el escenario "catálogo filtrado/ordenado" sigue reservado a `catalog-filter`/`catalog-sort`).
- `docs/risks-and-open-questions.md`: **not needed** — no cambian las preguntas abiertas; la decisión de no introducir E2E en este slice queda justificada en este spec y se reevalúa en features con flujos interactivos.
- `PROGRESS.md`, `feature_list.json`: **update** — evidencia de verificación al cerrar la sesión.

## Implementation Plan

1. Crear la capa de datos: `src/lib/db.ts` (singleton), `src/lib/format.ts` (`formatPriceCents`) y `src/lib/catalog.ts` (`getCatalogProducts`).
2. Escribir `src/lib/catalog.test.ts` (base temporal + `seedCatalog`, patrón de `prisma/seed.test.ts`) y confirmar que pasa.
3. Crear `src/app/globals.css` (tokens + base) e importarlo en `src/app/layout.tsx`.
4. Implementar `src/components/ProductCard.tsx` y `src/components/ProductGrid.tsx` + `ProductGrid.module.css` (grid 2/3/4 columnas, estado vacío).
5. Escribir `src/components/ProductGrid.test.tsx` (campos de la tarjeta + estado vacío).
6. Convertir `src/app/page.tsx` en el listado (async, `force-dynamic`, h1 "Catálogo") y adaptar `src/app/page.test.tsx` (mock de `src/lib/catalog`).
7. Ejecutar `./init.sh` completo (en verde) y comprobar manualmente con `pnpm dev`: 8 tarjetas con imagen/nombre/categoría/precio y columnas 2/3/4 según viewport; capturar evidencia.
8. Actualizar `ARCHITECTURE.md` y `CONSTRAINTS.md`; cerrar con `feature_list.json` + `PROGRESS.md`.

## Implementation Tasks

- [ ] Crear `src/lib/db.ts` (singleton `PrismaClient` con guard de HMR).
- [ ] Crear `src/lib/format.ts` (`formatPriceCents` con `Intl.NumberFormat("es-ES", …)`).
- [ ] Crear `src/lib/catalog.ts` (`getCatalogProducts` con `include: { category: true }`, `orderBy: { createdAt: "desc" }`).
- [ ] Crear `src/lib/catalog.test.ts` (base temporal `file:./test-catalog.db`; 8 productos con nombre/imagen/categoría/precio; orden por novedad).
- [ ] Crear `src/app/globals.css` (custom properties de `DESIGN.md` + base tipográfica) e importarlo en `layout.tsx`.
- [ ] Crear `src/components/ProductCard.tsx` (imagen `next/image unoptimized` con `alt` = nombre, nombre `h2`, categoría muted, precio formateado; sin enlaces).
- [ ] Crear `src/components/ProductGrid.tsx` + `ProductGrid.module.css` (grid 2/3/4 col. en <640/≥640/≥1024; estado vacío).
- [ ] Crear `src/components/ProductGrid.test.tsx` (una tarjeta por producto con los 4 campos; estado vacío).
- [ ] Modificar `src/app/page.tsx` (async, `force-dynamic`, h1 "Catálogo" + `ProductGrid`) y `src/app/page.test.tsx` (mock del catálogo).
- [ ] Ejecutar `./init.sh` en verde y la comprobación manual responsive con `pnpm dev`; capturar evidencia (incluida la descripción de columnas por viewport).
- [ ] Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md`, `feature_list.json`, `PROGRESS.md`.

## Verification Plan

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` → exit 0. `pnpm test` debe incluir: `src/lib/catalog.test.ts` (integración, base temporal), `src/components/ProductGrid.test.tsx` y `src/app/page.test.tsx` (adaptado).
- `./init.sh` → install + db:setup + lint + typecheck + test + build, exit 0, **sin arrancar dev servers** (gate no bloqueante; puede imprimir `pnpm dev` como seguimiento manual).
- Manual con `pnpm dev` (y `pnpm db:setup` previo si la base está vacía):
  - `/` lista 8 productos del seed con imagen visible (placeholders SVG), nombre, categoría y precio formateado (comprobar "Camiseta básica" · "Camisetas" · "19,99 €" y "Abrigo de invierno" · "119,99 €").
  - Responsive (devtools o redimensionando): 2 columnas por debajo de 640px, 3 de 640 a 1023px, 4 desde 1024px; sin scroll horizontal ni desbordes de texto.
  - Accesibilidad básica: `alt` descriptivo en las imágenes (nombre del producto), semántica `main`/`ul`/headings.
  - (Opcional) Estado vacío: con una base sin productos se muestra el mensaje amigable (también cubierto por test).
- E2E: **no se introduce harness E2E en este slice**. Justificación: (a) no existe comando E2E persistente (`pnpm test:e2e` no está definido) y crear el harness (Playwright + browsers descargados + ciclo de vida de servidor) es infraestructura transversal, no alcance de "listado de catálogo"; (b) el slice es una única página de solo lectura sin auth, mutations ni navegación; su superficie observable queda cubierta por el test de integración de la consulta contra la base sembrada real + tests de render del grid y de composición de la página; (c) la única afirmación no automatizable en jsdom (columnas por breakpoint) se verifica con el checklist manual arriba. Se reevalúa introducir E2E en el primer feature con flujo interactivo (`catalog-filter` con estado en URL o `product-detail` con navegación), donde el harness sí aporta regresión.
- `init.sh`: sin cambios; sigue ejecutando el gate no bloqueante y **no** arranca `pnpm dev`.

## Evidence To Capture

- Salida de `pnpm test` con los nombres de los tests nuevos (catálogo, grid, página) y recuento total.
- Salida de `pnpm lint` / `pnpm typecheck` / `pnpm build` y de `./init.sh` (exit 0, sin dev servers).
- Resultado del recorrido manual con `pnpm dev`: 8 tarjetas con sus 4 campos (con el ejemplo "Camiseta básica · Camisetas · 19,99 €") y columnas observadas por viewport (p. ej. "375px→2, 768px→3, 1280px→4"); captura de pantalla opcional.
- Confirmación de que la home renderiza datos de la base real (no mocks) en runtime (`force-dynamic`).
- Registrar todo en `feature_list.json` (campo `evidence`) y `PROGRESS.md`.

## Validator Checklist

- [ ] La implementación se mantiene dentro del alcance de `catalog-list` (solo listado + capa `src/lib` de lectura; sin filtros, ordenación interactiva, detalle/enlaces, tallas/badges, carrito, chatbot ni API routes).
- [ ] Los 5 escenarios de aceptación pasan (listado del seed con los 4 campos; grid 2/3/4 columnas; precios en es-ES desde centavos; estado vacío amigable; tests automatizados verdes).
- [ ] La cuadrícula se verifica a los breakpoints acordados (manual documentado) y el resto del comportamiento visible tiene test automatizado.
- [ ] E2E: se acepta la justificación de no introducir harness (registrada en Verification Plan) o se pide alineación si existiera ya un comando E2E persistente.
- [ ] Estilos según `DESIGN.md` (tokens, tarjetas, tipografía Inter/system) sin Tailwind ni frameworks CSS nuevos; imágenes con `next/image unoptimized` y `alt` descriptivo.
- [ ] La home se renderiza en modo dinámico y refleja la base real; el código no asume el nombre del fichero SQLite (usa `DATABASE_URL`).
- [ ] `feature_list.json` y `PROGRESS.md` fueron actualizados correctamente.
- [ ] No se añadió trabajo de features posteriores ni comportamiento no solicitado (el cambio de `page.test.tsx` es churn de alcance, no trabajo ajeno).
