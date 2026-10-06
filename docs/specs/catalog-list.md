# Feature Implementation Spec: Listado de catálogo

## Source Feature

- `id`: `catalog-list`
- `area`: `catalog`
- `depends_on`: `["bootstrap-seed"]` (satisfecho; `bootstrap-seed` en `accepted`)
- `status`: `not_started`
- `source`: `feature_list.json`

## Goal

Mostrar el catálogo de la tienda como primera pantalla de producto: una cuadrícula responsive de tarjetas de producto que lista los productos del seed con **imagen, nombre, categoría y precio**, leídos de SQLite en runtime (datos reales, no fixtures). Un invitado abre la app y ve el inventario con el aspecto de `DESIGN.md` (cards de producto, grid responsive 2-4 columnas). Esta feature además introduce la capa de acceso a datos en runtime (`src/lib/db`, reservada en `bootstrap-seed`) y la convención de estilos (CSS Modules + tokens de `DESIGN.md`), que usarán todas las features posteriores.

## Non-Goals

- Sin filtros ni ordenación ni controles para ellos: `catalog-filter` y `catalog-sort`.
- Sin página de detalle, selector de variante ni enlaces a `/productos/[slug]`: `product-detail` (las cards aún no son clicables).
- Sin "tallas disponibles" ni badges de stock en la card: la anatomía de card de `DESIGN.md` los menciona, pero el contrato de esta feature son los 4 campos (imagen, nombre, categoría, precio); tallas/stock viven en `product-detail`.
- Sin header/nav/carrito/chatbot/footer completos: solo el título de página (`h1`) y el grid; el chrome de la app llega con features posteriores.
- Sin estado de error personalizado (un fallo de base puede devolver la error page por defecto de Next); solo estado vacío amigable.
- Sin API routes ni server actions: el Server Component lee Prisma directamente.
- Sin `next/image` ni optimización de imágenes (los placeholders SVG locales se sirven con `<img>`); sin Tailwind ni librerías de estilos nuevas.
- Sin harness E2E (Playwright/Cypress) — decisión justificada en Verification Plan.
- Sin tocar `init.sh` ni el gate de verificación.

## Job Story

When quiero explorar la ropa disponible antes de comprar, como visitante sin cuenta,
I want ver un listado visual y responsive de los productos con su imagen, nombre, categoría y precio,
so I can identificar de un vistazo qué me interesa antes de entrar al detalle.

## Users And Permissions

- **Invitado (actor principal)**: ve el listado del catálogo en `/` sin cuenta ni sesión. Solo lectura.
- **Usuario registrado**: misma vista que el invitado. Sin control de acceso en esta feature.
- **Desarrollador/agente**: ejecuta `./init.sh`, `pnpm test` y `pnpm dev` para implementar/verificar.

## Acceptance Scenarios

### Scenario 1: El catálogo lista los productos del seed

Given la base poblada por `pnpm db:setup` (8 productos de ejemplo)
When el usuario abre `/` en el navegador
Then ve una cuadrícula con 8 tarjetas y cada tarjeta muestra imagen, nombre, categoría y precio del producto (p. ej. "Camiseta básica", "Camisetas", "19,99 €").

### Scenario 2: La cuadrícula es responsive

Given el catálogo renderizado
When el usuario lo ve en móvil (375px de ancho)
Then las tarjetas se disponen en 2 columnas (rango aceptado 1-2 según `DESIGN.md`).
When el usuario lo ve en escritorio (1280px de ancho)
Then las tarjetas se disponen en 4 columnas (rango aceptado 3-4 según `DESIGN.md`).

### Scenario 3: Los datos vienen de SQLite con precio formateado

Given productos con `priceCents` en la base (p. ej. 1999)
When se renderiza la tarjeta
Then el precio se muestra formateado en euros ("19,99 €") y nombre/categoría coinciden con los del seed (consulta real vía Prisma, sin datos cableados en la UI).

### Scenario 4: Estado vacío amigable

Given una base sin productos (catálogo vacío)
When el usuario abre `/`
Then ve un mensaje de estado vacío ("No hay productos disponibles.") sin errores de render ni de consola.

### Scenario 5: La verificación base sigue en verde

Given los cambios de esta feature (incluidos sus tests)
When el desarrollador ejecuta `./init.sh`
Then el gate completo (install + db:setup + lint + typecheck + test + build) sale con código 0, sin tocar el gate ni arrancar dev servers.

## Repository Research

### Files Inspected

- `feature_list.json` — alcance, verificación y dependencias de `catalog-list` (`bootstrap-seed` en `accepted`).
- `PROGRESS.md` — estado verificado; siguiente feature declarada: `catalog-list`.
- `AGENTS.md` — flujo de arranque y gate estándar (`./init.sh`).
- `CONTEXT.md`, `docs/build-brief.md`, `docs/domain-model.md` — glosario (Producto/Variante/Categoría/Catálogo), slice MVP y entidades.
- `DESIGN.md` — tokens (colores, tipografía Inter, radios, espacios), card de producto, grid 12 columnas, baseline responsive (móvil 1-2, tablet 2-3, escritorio 3-4 columnas) y accesibilidad (`alt` descriptivo, semántica, contraste AA).
- `docs/technical-discovery.md` — inspección parcial (búsqueda de referencias a catálogo/UI/E2E): monolito Next.js con API routes/server actions; tests unitarios/integración ya cubiertos por Vitest.
- `docs/risks-and-open-questions.md` — idioma de UI asumido español (pendiente de confirmar); sin bloqueos para este slice.
- `docs/specs/bootstrap-stack.md`, `docs/specs/bootstrap-seed.md` — estructura/estilo de spec; `bootstrap-seed` reserva `src/lib/db` para esta feature y anuncia "E2E a partir de `catalog-list`" (se corrige aquí, ver Verification Plan).
- `prisma/schema.prisma` — modelos `Product` (`slug`, `name`, `description`, `imageUrl`, `priceCents`, `currency`, `categoryId`) y `Category` (`slug`, `name`); dinero en centavos.
- `prisma/seed.ts` — `seedCatalog(prisma)` exportado; 3 categorías, 8 productos, 29 variantes; `imageUrl = "/images/products/<slug>.svg"`; `createdAt` escalado (base para el orden por novedad).
- `prisma/seed.test.ts` — patrón de test sobre base temporal (`file:./test-seed.db` resuelto bajo `prisma/`): `prisma migrate deploy` vía `execSync` con `DATABASE_URL` sobrescrito + `seedCatalog`; docblock `// @vitest-environment node`; limpieza al final.
- `public/images/products/*.svg` — 8 placeholders locales que coinciden con los slugs del seed.
- `src/app/layout.tsx` — layout raíz mínimo (`lang="es"`, metadata "Tienda de ropa"); **sin importar CSS**.
- `src/app/page.tsx`, `src/app/page.test.tsx` — home placeholder ("Base técnica lista.") y su smoke test (hay que reescribir ambos).
- `package.json` — scripts `dev/build/start/lint/typecheck/test` + `db:setup`/`db:seed`; **sin `test:e2e`** ni Playwright/Cypress.
- `tsconfig.json` — alias `@/*` → `./src/*`; `include` con `**/*.ts(x)` (todo el código nuevo queda bajo `typecheck`).
- `vitest.config.ts`, `vitest.setup.ts` — Vitest + jsdom global; entorno `node` por docblock en tests de datos.
- `next.config.ts` — config vacía (sin Tailwind ni `images`).
- `init.sh` — gate: install → asegurar `.env` → `pnpm db:setup` → lint → typecheck → test → build; sin dev servers.
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — capas actuales (UI + persistencia; "lógica de dominio/servicios: features posteriores") y reglas durables.

Nota: no existen `src/lib/`, `src/components/`, ningún archivo CSS en `src/`, ni harness E2E. No existen `docs/mvp-scope.md`, `docs/product-brief.md`, `docs/user-and-access-model.md` ni `docs/adr/*`.

### Existing Patterns To Follow

- **Acceso a datos reservado**: `bootstrap-seed` dejó explícito que `src/lib/db` lo introduce `catalog-list`; el singleton `PrismaClient` debe vivir ahí (patrón `globalThis` para sobrevivir al HMR de Next dev).
- **Tests**: Vitest colocados junto al código (`*.test.tsx`); tests de datos en entorno `node` sobre base temporal bajo `prisma/` con `prisma migrate deploy` + `seedCatalog` (reutilizar el patrón literal de `prisma/seed.test.ts`; las URLs `file:./x.db` se resuelven bajo `prisma/`).
- **Dinero en centavos** (`priceCents`) — formatear a euros solo en presentación.
- **UI en español**, docs/comentarios en español; TypeScript estricto; gate desde `./init.sh` sin cambios.
- **`DATABASE_URL="file:./dev.db"`** (relativa a `prisma/`); Next.js carga `.env` nativamente en runtime (el `process.loadEnvFile` explícito solo es necesario en scripts sueltos como el seed).

### Current Gaps

- Sin capa de acceso a datos en runtime ni singleton de Prisma fuera del seed.
- Sin convención de estilos (no hay CSS en `src/`; el scaffold fue `--no-tailwind`).
- La home es un placeholder sin contenido de producto; su test solo cubre el placeholder.
- Sin estado vacío ni semántica de catálogo en ninguna vista.
- Sin harness E2E persistente (asentado en specs previas como "a partir de `catalog-list`"; decisión revisada en Verification Plan).

## Technical Approach

1. **Ruta**: `/` (home) es la página de catálogo. Se sustituye el placeholder por el listado: la tienda abre mostrando el inventario (única pantalla de entrada del MVP; no existe feature de landing). Alternativa descartada: ruta dedicada `/catalogo` con home vacía — dejaría la entrada de la app sin valor. El `h1` de la página es "Catálogo". Las features `catalog-filter`/`catalog-sort` montarán sus controles sobre esta misma ruta.
2. **Acceso a datos** (`src/lib/`):
   - `db.ts`: `PrismaClient` singleton (guardado en `globalThis` para dev/HMR); única puerta a Prisma desde `src/`.
   - `catalog.ts`: `listCatalogProducts(prisma = db)` → `CatalogProduct[]` con `{ id, slug, name, imageUrl, priceCents, currency, categoryName }`, `include: { category: true }` y orden **`createdAt` desc** (novedad primero; coherente con el `createdAt` escalado del seed y base para `catalog-sort`). Cliente inyectable para testear sin el singleton.
   - `format.ts`: `formatPrice(priceCents, currency)` vía `Intl.NumberFormat("es-ES", { style: "currency", currency })` sobre `priceCents / 100` (p. ej. 1999 → "19,99 €"; ojo: `Intl` puede emitir espacio fino/NBSP antes de "€" — los tests comparan con el propio helper o regex tolerante).
3. **Página** `src/app/page.tsx`: Server Component `async` que llama `listCatalogProducts()` y renderiza el grid. **`export const dynamic = "force-dynamic"`** para que la página se renderice por request leyendo la base actual (evita prerender del catálogo en `pnpm build` y dependencia de base en build; sin esto Next podría congelar los datos del build).
4. **Componentes presentacionales** (`src/components/`), puros y sin Prisma (testeables en jsdom):
   - `product-card.tsx`: `<img src={imageUrl} alt={name}> + nombre + nombre de categoría + precio formateado`. Imagen con `aspect-ratio: 1/1` y `object-fit: contain` sobre fondo `surface` (sin recortar el texto de los placeholders SVG; `cover` puede aplicarse cuando haya fotos). **Sin enlace** (lo añade `product-detail`).
   - `product-grid.tsx`: `<main>` semántico con `h1` "Catálogo" + `<ul>`/`<li>` de cards; si `products.length === 0` muestra el estado vacío ("No hay productos disponibles.").
5. **Estilos**: convención CSS Modules (`*.module.css`) + `src/app/globals.css` (importado en `layout.tsx`) con los tokens de `DESIGN.md`: fuente `Inter, system-ui, ...`; colores `primary #111827`, `textMuted #6B7280`, `background #FFFFFF`, `surface #F3F4F6`; radios `6px/10px`; espacios `8/16/24px`. Grid de cards con `grid` + `gap: 16px` y breakpoints:
   - base: **2 columnas** (móvil, ≥360px; cumple "1-2 en móvil"),
   - `min-width: 768px`: **3 columnas** (tablet),
   - `min-width: 1200px`: **4 columnas** (escritorio; cumple "3-4 en escritorio").
   Contenedor de página con `max-width` (~1200px) centrado y padding `24px` (el "grid de 12 columnas" de `DESIGN.md` se resuelve con este contenedor; no hace falta un framework de 12 columnas). Accesibilidad: `alt` descriptivo (nombre del producto), semántica `main`/`h1`/`ul`, contraste AA con los tokens.
6. **Tests** (Vitest, sin dependencias nuevas):
   - `src/lib/catalog.test.ts` (entorno `node`, base temporal `file:./test-catalog.db` bajo `prisma/` con `prisma migrate deploy` + `seedCatalog`, patrón de `prisma/seed.test.ts`, limpieza al final): `listCatalogProducts(client)` devuelve 8 productos con los 4 campos + `categoryName` correctos y ordenados por `createdAt` desc.
   - `src/components/product-card.test.tsx` y `src/components/product-grid.test.tsx` (jsdom): la card renderiza imagen (`alt` = nombre), nombre, categoría y precio formateado; el grid lista N cards y muestra el estado vacío con 0 productos.
   - `src/app/page.test.tsx` (jsdom, reescribe el actual): `vi.mock` de `src/lib/catalog`, `render(await Home())` → lista las cards del fixture y cubre el estado vacío (así la home queda cubierta sin tocar Prisma en jsdom).

## Expected File Changes

- `src/lib/db.ts` — create; singleton `PrismaClient` (`globalThis`).
- `src/lib/catalog.ts` — create; `listCatalogProducts` (DTO + `createdAt` desc, cliente inyectable).
- `src/lib/format.ts` — create; `formatPrice`.
- `src/lib/catalog.test.ts` — create; test de datos sobre base temporal (entorno `node`).
- `src/components/product-card.tsx` + `product-card.module.css` + `product-card.test.tsx` — create; card de producto.
- `src/components/product-grid.tsx` + `product-grid.module.css` + `product-grid.test.tsx` — create; grid responsive + estado vacío.
- `src/app/globals.css` — create; tokens de `DESIGN.md` + estilos base.
- `src/app/layout.tsx` — modify; importar `globals.css`.
- `src/app/page.tsx` — modify; home → catálogo (RSC async + `force-dynamic`).
- `src/app/page.test.tsx` — modify; smoke del catálogo con `listCatalogProducts` mockeado.
- `vitest.config.ts` — modify (hallazgo del implementer; no previsto inicialmente): replicar el alias `@/* → ./src/*` de `tsconfig` en `resolve.alias` (Vitest no lee `paths` de tsconfig) y aplicar `cleanup` explícito en los tests que renderizan varias veces (Vitest sin `globals: true` no activa la limpieza automática de Testing Library). Sin dependencias nuevas.
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — update (ver Durable Documentation Impact).
- `feature_list.json`, `PROGRESS.md` — update; evidencia al cerrar la sesión de implementación.
- `package.json`, `init.sh`, `prisma/*`, `next.config.ts`, `tsconfig.json` — **not needed** (sin dependencias nuevas, sin gate nuevo, sin cambios de esquema; CSS Modules y `Intl` son de serie).

## Visual Design Impact

- UI involved: **yes** (primera pantalla de producto de la app).
- Design source: `DESIGN.md` (tokens del frontmatter + secciones Components/Layout/Responsive Baseline/Accessibility Baseline).
- Screens or states affected: listado/catálogo en `/` (grid + cards + estado vacío); home placeholder eliminado.
- New design artifact required: no — `DESIGN.md` cubre esta pantalla. Nota de alcance: la card de `DESIGN.md` incluye "tallas disponibles"; esta feature la deja fuera a propósito (ver Non-Goals), sin generar artefacto nuevo.
- Estados visuales a manejar: listado poblado (grid de cards) y estado vacío (mensaje centrado, tipografía `body`, `textMuted`).

## Durable Documentation Impact

- `ARCHITECTURE.md`: **update** — la capa "Lógica de dominio/servicios" deja de estar pendiente: documentar `src/lib/` (`db.ts` singleton Prisma, `catalog.ts` consultas, `format.ts`), el patrón de página (RSC async + `force-dynamic`), la convención de estilos (CSS Modules + `globals.css` con tokens de `DESIGN.md`, sin Tailwind) y la decisión sobre E2E (diferido al primer flujo mutante, p. ej. `cart-add`/`product-detail`; corrige la nota "E2E a partir de `catalog-list`" de specs previas).
- `CONSTRAINTS.md`: **update** — MUST nuevos: Prisma solo desde `src/lib/db` (ningún `new PrismaClient()` fuera); dinero en UI siempre vía `formatPrice` (nunca concatenar centavos); estilos con CSS Modules + tokens de `DESIGN.md` (sin nuevas librerías de estilo). Sin cambios en MUST NOT.
- `AGENTS.md`: **not needed** — ni el flujo de arranque, ni el gate, ni la ruta de verificación cambian.
- `docs/risks-and-open-questions.md`: **not needed** — no se abren ni cierran riesgos (el idioma de UI sigue asumido español; texto de esta feature en español).
- `docs/domain-model.md`, `docs/technical-discovery.md`, `DESIGN.md`, `CONTEXT.md`: **not needed** — el listado no cambia dominio, stack ni dirección visual.
- `PROGRESS.md`, `feature_list.json`: **update** — evidencia de verificación al cerrar la sesión de implementación.

## Implementation Plan

1. Crear `src/lib/db.ts` (singleton), `src/lib/format.ts` (`formatPrice`) y `src/lib/catalog.ts` (`listCatalogProducts` con cliente inyectable y `createdAt` desc).
2. Escribir `src/lib/catalog.test.ts` sobre base temporal (patrón de `prisma/seed.test.ts`) y dejarlo en verde.
3. Crear `src/app/globals.css` (tokens de `DESIGN.md`) e importarlo en `src/app/layout.tsx`.
4. Implementar `product-card.tsx` y `product-grid.tsx` con sus CSS Modules (breakpoints 2/3/4 columnas) y sus tests (jsdom).
5. Reescribir `src/app/page.tsx` (RSC async + `force-dynamic`) y `src/app/page.test.tsx` (mock de `src/lib/catalog`).
6. Ejecutar `./init.sh` completo y confirmar exit 0.
7. Actualizar `ARCHITECTURE.md` y `CONSTRAINTS.md`; cerrar con `feature_list.json` (evidence) y `PROGRESS.md`.

## Implementation Tasks

- [ ] Crear `src/lib/db.ts` (singleton `PrismaClient` vía `globalThis`).
- [ ] Crear `src/lib/format.ts` (`formatPrice` desde centavos con `Intl` es-ES).
- [ ] Crear `src/lib/catalog.ts` (`listCatalogProducts(prisma = db)` → DTO con `categoryName`, orden `createdAt` desc).
- [ ] Crear `src/lib/catalog.test.ts` (base temporal `file:./test-catalog.db` + `prisma migrate deploy` + `seedCatalog`; 8 productos, campos y orden).
- [ ] Crear `src/app/globals.css` con tokens de `DESIGN.md` e importarlo en `src/app/layout.tsx`.
- [ ] Crear `src/components/product-card.tsx` (+ `.module.css`, + test): imagen con `alt` = nombre, nombre, categoría, precio formateado.
- [ ] Crear `src/components/product-grid.tsx` (+ `.module.css`, + test): `h1` "Catálogo", `ul`/`li`, grid 2/3/4 columnas (base/768px/1200px), estado vacío.
- [ ] Reescribir `src/app/page.tsx` (async, `force-dynamic`, `listCatalogProducts`) y `src/app/page.test.tsx` (`vi.mock` de `src/lib/catalog`; listado + estado vacío).
- [ ] Ejecutar `./init.sh` en verde (sin cambios en el script).
- [ ] Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md`, `feature_list.json`, `PROGRESS.md`.

## Verification Plan

- `./init.sh` → exit 0 (install + db:setup + lint + typecheck + test + build) con los tests nuevos incluidos; **sin** modificar el script ni arrancar dev servers.
- `pnpm test` → incluye `src/lib/catalog.test.ts`, `product-card.test.tsx`, `product-grid.test.tsx` y `page.test.tsx` en verde (evidencia: nombres de tests + salida).
- `pnpm dev` (manual) → `http://localhost:3000/` responde HTTP 200 con el catálogo.
- **E2E**: no hay comando E2E persistente (`pnpm test:e2e` no existe; sin Playwright/Cypress). Esta feature cambia UI observable, pero **se justifica no introducir un harness E2E en este slice**: (1) el flujo es de solo lectura, sin estado, navegación mutante ni API; (2) el contrato clave es visual/responsive, que la verificación visual con Chrome DevTools MCP cubre mejor que un runner headless; (3) añadir Playwright + binarios de navegador amplía el gate y el alcance ("solo el grid") sin valor proporcional. La cobertura automatizada de Vitest (datos reales contra base temporal + render de componentes/página) es suficiente y procedente. Corrección de specs previas ("E2E a partir de `catalog-list`"): el harness E2E se introducirá con el primer flujo mutante (`cart-add` o `product-detail`), decisión que queda registrada en `ARCHITECTURE.md`.
- **Verificación visual obligatoria (Chrome DevTools MCP, solo el validator — ni el planner ni el implementer la ejecutan)**, con la base sembrada (`./init.sh` o `pnpm db:setup`) y `pnpm dev` en marcha:
  - `navigate_page` a `http://localhost:3000/`.
  - `take_snapshot`: `h1` "Catálogo"; 8 tarjetas, cada una con imagen (`alt` = nombre del producto), nombre, categoría y precio en "€" (p. ej. "Camiseta básica" / "Camisetas" / "19,99 €").
  - Desktop 1280×800 (`resize_page`/`emulate`): `take_screenshot` → `docs/evidence/catalog-list-desktop-1280.png`; se esperan **4 columnas** (rango 3-4) — confirmar por número de cards por fila en la captura.
  - Móvil 375×667 (`emulate`/`resize_page`): `take_snapshot` + `take_screenshot` → `docs/evidence/catalog-list-mobile-375.png`; se esperan **2 columnas** (rango 1-2).
  - Opcional: tablet 768×1024 → 3 columnas (captura opcional).
  - `list_console_messages` en la ruta: sin errores nuevos de consola (en particular sin 404 de `/images/products/*.svg`).
- `init.sh`: no cambia; sigue siendo el gate **no bloqueante** estándar (install + db:setup + lint + typecheck + test + build) y **no** arranca servicios de larga vida.

## Evidence To Capture

- Salida de `pnpm test` con los nombres de los tests nuevos (`src/lib/catalog.test.ts`, `src/components/*.test.tsx`, `src/app/page.test.tsx`).
- Salida de `./init.sh` (exit 0, pasos sin cambios) y de `pnpm lint` / `pnpm typecheck` / `pnpm build`.
- Resumen del `take_snapshot` (8 cards con imagen/nombre/categoría/precio) y rutas de las capturas del validator: `docs/evidence/catalog-list-desktop-1280.png` y `docs/evidence/catalog-list-mobile-375.png`, más el resultado de `list_console_messages` (sin errores).
- Resultado de `list_console_messages` en `/` (limpio) y conteo de columnas observado en cada viewport (2 en móvil, 4 en escritorio).
- Registrar todo en `feature_list.json` (campo `evidence`) y `PROGRESS.md`.

## Validator Checklist

- [ ] La implementación se mantiene dentro del alcance de `catalog-list` (solo el grid de listado: sin filtros, ordenación, detalle, enlaces a detalle, carrito, header/nav completos ni harness E2E).
- [ ] Los 5 escenarios de aceptación pasan (listado del seed; 2 columnas móvil / 4 escritorio; datos reales con precio formateado; estado vacío; `./init.sh` en verde).
- [ ] El catálogo se lee de SQLite en runtime vía `src/lib/db`/`src/lib/catalog` (sin datos cableados en la UI) y respeta el orden `createdAt` desc.
- [ ] Evidencia visual con Chrome DevTools MCP capturada por el validator: snapshot + `docs/evidence/catalog-list-desktop-1280.png` + `docs/evidence/catalog-list-mobile-375.png` + `list_console_messages` limpio en `http://localhost:3000/`.
- [ ] La justificación de no-E2E del Verification Plan se acepta y quedó registrada en `ARCHITECTURE.md` (promesa previa corregida).
- [ ] La card muestra exactamente imagen, nombre, categoría y precio (con `alt` descriptivo); precios en euros desde centavos vía `formatPrice`.
- [ ] `feature_list.json` y `PROGRESS.md` fueron actualizados correctamente (evidencia incluida).
- [ ] No se añadió trabajo de features posteriores ni comportamiento no solicitado.

## Implementation Findings (implementer)

- **`vitest.config.ts` era necesario** (no estaba en Expected File Changes): los tests exigidos importan `@/lib/*` y `@/components/*`, y Vitest no resuelve los `paths` de `tsconfig` por sí mismo. Se añadió `resolve.alias` (`@ → ./src`) sin dependencias nuevas. Durante la verificación también se detectó que, sin `globals: true`, Testing Library no limpia el DOM entre tests; se resolvió con `afterEach(() => cleanup())` en `product-card.test.tsx`, `product-grid.test.tsx` y `page.test.tsx` (en vez de ampliar la configuración global). Sin impacto en el alcance funcional del listado.
- El resto del plan (rutas, DTO, orden `createdAt` desc, tokens, breakpoints 2/3/4, estado vacío, `force-dynamic`) se implementó tal cual. La card usa `<img>` (con `eslint-disable-next-line @next/next/no-img-element` justificado por el Non-Goal de no usar `next/image`).
