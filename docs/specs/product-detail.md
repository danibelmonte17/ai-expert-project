# Feature Implementation Spec: Detalle de producto con selector de variante

## Source Feature

- `id`: `product-detail`
- `area`: `catalog`
- `depends_on`: `["catalog-list"]` (satisfecho; `catalog-list` en `accepted`)
- `status`: `not_started`
- `source`: `feature_list.json`

## Goal

Mostrar la ficha de cada producto del catálogo en `/productos/[slug]`: imagen, descripción, precio, categoría y un selector de variante (talla/color) que muestra el estado y el stock de la combinación elegida — `Disponible` (stock > 0) / `Agotada` (stock = 0), estados derivados definidos en `docs/domain-model.md` — leídos de SQLite en runtime. Un invitado abre la ficha desde la card del catálogo (que por fin navega), elige talla y color sobre la matriz real de variantes (no todas las combinaciones existen) y ve si su combinación está disponible y con cuántas unidades, o agotada y por tanto no comprable. La pantalla de detalle queda como ancla donde se montarán después la prueba virtual (`tryon-*`) y la compra (`cart-add`).

## Non-Goals

- Sin lógica de carrito ni compra: el botón "Añadir al carrito" solo modela su **estado** (`disabled` sin variante válida o con variante `Agotada`); la acción de añadir, las cantidades y la persistencia son de `cart-add`.
- Sin try-on: solo se documenta el punto de anclaje en la ficha (`tryon-upload` / `tryon-result`).
- Sin filtros ni ordenación (`catalog-filter`, `catalog-sort`); sin header/nav/carrito/chatbot completos (solo un enlace "← Volver al catálogo").
- Sin galería multi-imagen (el modelo tiene una `imageUrl` por producto) ni selector de cantidades (`cart-add` / `cart-manage`).
- Sin API routes ni server actions: el detalle se lee en el RSC y la selección de variante es estado de cliente.
- Sin sincronizar la selección con la URL ni deep-links `?talla=`/`?color=`.
- Sin harness E2E (justificado en Verification Plan).
- Sin cambios en esquema, migraciones, seed, `init.sh`, `next/image` ni librerías de estilo nuevas.

## Job Story

When una prenda del catálogo me interesa y necesito comprobar si mi talla y mi color están disponibles antes de comprar,
I want abrir su ficha, ver imagen, descripción y precio y elegir talla y color viendo el stock de cada combinación,
so I can saber si puedo comprarla o si mi combinación está agotada, sin sorpresas.

## Users And Permissions

- **Invitado (actor principal)**: ve la ficha y selecciona variante en `/productos/[slug]` sin cuenta. Solo lectura.
- **Usuario registrado**: misma vista que el invitado. Sin control de acceso en esta feature.
- **Desarrollador/agente**: ejecuta `./init.sh`, `pnpm test` y `pnpm dev` para implementar/verificar.

## Acceptance Scenarios

### Scenario 1: La ficha muestra imagen, descripción, precio y variantes

Given la base poblada por `pnpm db:setup`
When el usuario abre `/productos/camiseta-basica`
Then ve la imagen (con `alt` = "Camiseta básica"), el nombre como `h1`, la categoría "Camisetas", la descripción del seed, el precio "19,99 €" y los selectores con las tallas presentes (S, M, L, XL) y los colores presentes (negro, blanco, azul, rojo); sin selección aún, el CTA "Añadir al carrito" está `disabled`.

### Scenario 2: Al elegir talla y color se muestra la variante correcta y su stock

Given la ficha de `camiseta-basica` sin selección
When el usuario elige la talla "S" y el color "negro"
Then se resuelve la variante `camiseta-basica-S-negro` y se muestran su estado y stock ("Disponible · 12 en stock") y su precio.

### Scenario 3: Una variante agotada se muestra como tal y no puede comprarse

Given la ficha de `camiseta-estampada`, cuya variante S/negro tiene stock 0 en el seed
When el usuario elige la talla "S" y el color "negro"
Then el estado se muestra como "Agotada" en color de error y el botón "Añadir al carrito" queda `disabled`.

### Scenario 4: Las combinaciones inexistentes no se pueden seleccionar

Given la matriz de variantes real (p. ej. `camiseta-basica` no tiene la combinación S/blanco)
When el usuario explora los selectores
Then los chips sin variante combinable aparecen `disabled`, y al cambiar un eje dejando la selección sin variante (p. ej. color "blanco" y después talla "S") se limpia el otro eje; en ningún caso se resuelve una variante inexistente.

### Scenario 5: Un slug desconocido devuelve 404

Given la URL `/productos/no-existe` sin producto asociado
When el usuario la abre
Then la app responde con la página 404 (`notFound()`), sin errores de render.

### Scenario 6: La verificación base sigue en verde

Given los cambios de esta feature (incluidos sus tests)
When el desarrollador ejecuta `./init.sh`
Then el gate completo (install + db:setup + lint + typecheck + test + build) sale con código 0, sin tocar el gate ni arrancar dev servers.

## Repository Research

### Files Inspected

- `feature_list.json` — alcance/verificación de `product-detail`; dependencia `catalog-list` en `accepted`.
- `PROGRESS.md` — `catalog-list` aceptado; sus desviaciones asentadas (`vitest.config.ts` con alias `@/*` y `cleanup` explícito en tests jsdom).
- `CONTEXT.md`, `docs/domain-model.md` — `Producto`/`Variante`; estado derivado `Disponible` (stock > 0) / `Agotada` (stock = 0); edge case "variante agotada: no se puede añadir/comprar; se muestra como agotada".
- `docs/build-brief.md` — "Detalle de producto con selector de talla/color y stock" en el slice MVP; el try-on vive en el detalle.
- `DESIGN.md` — pantalla de detalle "dos columnas (galería de imagen + info/compra)" y apilado en móvil; badge de stock verde/rojo (`success`/`danger`); chips tipo píldora; `button-primary`; touch targets ≥ 44px; `alt` descriptivo y `aria-live` para estados.
- `ARCHITECTURE.md` — capas (`src/app` → `src/components` + `src/lib` → Prisma); decisión "E2E diferido al primer flujo mutante (`cart-add` o `product-detail`)" que esta feature fija (ver Verification Plan).
- `CONSTRAINTS.md` — MUST: Prisma solo desde `src/lib/db`, dinero en UI vía `formatPrice`, CSS Modules + tokens de `DESIGN.md`.
- `docs/risks-and-open-questions.md` — sin bloqueos para este slice (idioma de UI asumido español).
- `prisma/schema.prisma` — `Product` (`slug`, `name`, `description`, `imageUrl`, `priceCents`, `currency`) y `Variant` (`size`, `color`, `sku`, `stock`, `priceCents`, `@@unique([productId, size, color])`).
- `prisma/seed.ts` — 29 variantes con **matriz sparse** (3–4 por producto; no existen todas las combinaciones talla×color); agotadas: `camiseta-estampada` S/negro (stock 0) y `pantalon-vaquero` M/azul (stock 0); `camiseta-basica` S/negro tiene stock 12 (fixtures literales para los escenarios).
- `src/lib/db.ts`, `src/lib/catalog.ts`, `src/lib/format.ts` — singleton `db`, `listCatalogProducts(prisma = db)` con DTO tipado y cliente inyectable, `formatPrice`.
- `src/lib/catalog.test.ts`, `prisma/seed.test.ts` — patrón de test de datos sobre base temporal bajo `prisma/` (`prisma migrate deploy` + `seedCatalog`, docblock `// @vitest-environment node`, limpieza al final).
- `src/app/page.tsx`, `src/app/page.test.tsx` — patrón de página RSC `async` + `export const dynamic = "force-dynamic"` y test con `vi.mock` del módulo de datos.
- `src/components/product-card.tsx`, `src/components/product-grid.tsx` (+ `.module.css` + tests) — patrón de componente presentacional con CSS Modules y tokens; la card está **sin enlace** a propósito ("lo añade `product-detail`").
- `src/app/globals.css` — tokens: `--color-primary`, `--color-surface`, `--color-text-muted`, `--color-success`, `--color-danger`, `--radius-sm/md`, `--space-sm/md/lg`.
- `package.json`, `vitest.config.ts`, `init.sh` — `pnpm test` = `vitest run`; **sin `test:e2e`** ni Playwright/Cypress; gate estándar sin tocar.

Nota: no existen `docs/mvp-scope.md`, `docs/product-brief.md`, `docs/user-and-access-model.md` ni `docs/adr/*`.

### Existing Patterns To Follow

- Consultas en `src/lib/*` con `prisma: PrismaClient = db` inyectable y DTO tipado propio (la UI no ve modelos de Prisma).
- Dinero en centavos en los datos; `formatPrice` en la UI.
- CSS Modules por componente + tokens de `globals.css`; sin librerías de estilo.
- Página RSC en `src/app` con `force-dynamic` + componentes presentacionales puros en `src/components` (testeables en jsdom).
- Tests colocados junto al código; tests de datos en entorno `node` sobre base temporal; `afterEach(() => cleanup())` explícito en los tests jsdom que renderizan varias veces.

### Current Gaps

- Sin ruta de detalle ni segmento dinámico bajo `src/app`.
- Sin consulta de producto por slug ni DTO de detalle/variantes.
- Sin lógica de resolución de variante (matriz sparse) ni estado de selección en cliente: aún no hay ningún componente `"use client"` en el repo.
- Las cards del catálogo no navegan (sin `<a>`).
- Sin harness E2E persistente.

## Technical Approach

1. **Ruta**: `src/app/productos/[slug]/page.tsx` bajo `/productos/[slug]` (convención ya anunciada en el Non-Goal de `catalog-list`). Server Component `async` con `export const dynamic = "force-dynamic"` (misma razón que `/`: stock y precios leídos por request; la base no se congela en `next build`). **Next 15: `params` es una `Promise`** — desestructurar con `const { slug } = await params` (también en `generateMetadata`). Si `getProductDetailBySlug(slug)` devuelve `null` → `notFound()` (`next/navigation`) → página 404 de Next. `generateMetadata` → `title: product.name`.
2. **Acceso a datos** (ampliar `src/lib/catalog.ts`): DTOs `ProductVariant { id, size, color, sku, stock, priceCents }` y `CatalogProductDetail { id, slug, name, description, imageUrl, priceCents, currency, categoryName, variants: ProductVariant[] }` + `getProductDetailBySlug(slug, prisma = db)` con `findUnique({ where: { slug }, include: { category: true, variants: { orderBy: [{ size: "asc" }, { color: "asc" }] } } })` → `null` si no existe. Cliente inyectable (mismo patrón que `listCatalogProducts`).
3. **Lógica de variantes** (`src/lib/variants.ts`, nuevo y puro, sin Prisma): `variantState(stock)` → `"Disponible" | "Agotada"`; `resolveVariant(variants, size, color)`; `sizesIn(variants)` / `colorsIn(variants)` en orden canónico (`S, M, L, XL` / `negro, blanco, azul, rojo`, filtrado a los presentes); `isSelectable(variants, size?, color?)` (existe al menos una variante compatible con la selección parcial + el valor candidato) y `isSoldOutOption(variants, size?, color?)` (todas las variantes compatibles tienen `stock = 0`). Así la matriz sparse se testea sin DOM y los componentes quedan finos.
4. **Selección (estado de cliente)** en `src/components/product-detail.tsx` (`"use client"`): `useState` de `{ size?: string; color?: string }`. Reglas: (a) un chip se renderiza `disabled` si `isSelectable(...)` es falso para su valor con la selección del otro eje; (b) un chip se marca como agotado (estilo `--color-danger`, pero **sigue seleccionable**, para poder ver la variante agotada); (c) al cambiar un eje, si la combinación resultante no tiene variante se limpia el otro eje; (d) la variante resuelta es `resolveVariant(variants, size, color)` solo con ambos ejes fijados (única garantizada por `@@unique([productId, size, color])`).
5. **Componentes** (`src/components/`):
   - `variant-selector.tsx` (+ `.module.css` + test): dos grupos (`role="group"`, `aria-label="Talla"` / `"Color"`) de chips `<button type="button" aria-pressed={...}>` estilo píldora (radio `--radius-md`, fondo `--color-surface`, selección con `--color-primary` + texto blanco, marca de agotado con `--color-danger`, `disabled` con opacidad reducida, targets ≥ 44px). Controlado: recibe opciones + selección + `onSelectSize`/`onSelectColor`.
   - `product-detail.tsx` (+ `.module.css` + test, `"use client"`): enlace "← Volver al catálogo" (`Link` a `/`), `h1` = nombre, imagen (misma pauta que la card: `aspect-ratio 1/1`, `object-fit: contain`, fondo `--color-surface`, `alt` = nombre), categoría (`--color-text-muted`), descripción, precio (`formatPrice` de la variante resuelta si la hay — coincide con el base en el seed —, si no el `priceCents` del producto), selector, región de stock (`aria-live="polite"`): sin selección → hint "Selecciona talla y color para ver el stock." (`--color-text-muted`); con variante → badge "Disponible" (`--color-success`) + "{stock} en stock" o "Agotada" (`--color-danger`). CTA "Añadir al carrito" (`button-primary`; `disabled` si no hay variante o `stock = 0`; **sin handler de compra**). Si el producto no tuviera variantes (fuera del contrato 1..n del dominio): nota "Este producto no tiene variantes disponibles." y CTA `disabled`. **Ancla try-on**: dejar comentado en la columna info/compra el punto de montaje de `tryon-upload` (sin UI).
   - `product-card.tsx` (modificar): envolver el contenido en `Link` de `next/link` a `/productos/${product.slug}` (card entera clicable); actualizar el comentario "Sin enlace..." y su test.
6. **Layout responsive** (`.module.css` de `product-detail`): contenedor con el mismo `max-width: 1200px` + `padding: var(--space-lg)` que el catálogo; grid de **1 columna en base** (ficha apilada en móvil) y **2 columnas desde 768px** (imagen | info/compra) con `gap: var(--space-lg)` (baseline de `DESIGN.md`). Accesibilidad: `main` + `h1`, `alt` descriptivo, focus visible, targets ≥ 44px.
7. **Tests**: sin dependencias nuevas; ver Verification Plan.

## Expected File Changes

- `src/lib/catalog.ts` — modify; DTOs `ProductVariant`/`CatalogProductDetail` + `getProductDetailBySlug(slug, prisma = db)`.
- `src/lib/catalog.test.ts` — modify; tests de `getProductDetailBySlug` sobre la base temporal existente.
- `src/lib/variants.ts` — create; helpers puros de la matriz de variantes.
- `src/lib/variants.test.ts` — create; tests unitarios de los helpers (entorno `node`).
- `src/components/variant-selector.tsx` + `variant-selector.module.css` + `variant-selector.test.tsx` — create; chips de talla/color.
- `src/components/product-detail.tsx` + `product-detail.module.css` + `product-detail.test.tsx` — create; ficha con estado de selección, stock y CTA.
- `src/components/product-card.tsx` — modify; `Link` a `/productos/[slug]` + comentario.
- `src/components/product-card.test.tsx` — modify; assert del enlace.
- `src/app/productos/[slug]/page.tsx` — create; RSC async (`await params`) + `force-dynamic` + `notFound()` + `generateMetadata`.
- `src/app/productos/[slug]/page.test.tsx` — create; mock de `@/lib/catalog` (ficha + `notFound`).
- `ARCHITECTURE.md` — update; `feature_list.json`, `PROGRESS.md` — update (cierre de sesión).
- `vitest.config.ts` — not needed en principio (alias `@/*` ya existe); solo tocar si el test bajo la carpeta `[slug]` no se recoge (ver Risks).
- `package.json`, `init.sh`, `prisma/*`, `src/app/globals.css`, `CONSTRAINTS.md`, `AGENTS.md` — not needed (sin dependencias ni gate nuevos; tokens existentes suficientes).

## Visual Design Impact

- UI involved: **yes** (pantalla de detalle y navegación desde las cards).
- Design source: `DESIGN.md` (Core Screens #2 "Detalle de producto: galería, selector talla/color, stock, try-on, añadir al carrito"; Layout "dos columnas…", móvil apilado; Components: badge stock, chips píldora, `button-primary`; Accessibility Baseline).
- Screens or states affected: nueva ficha `/productos/[slug]`; la card del catálogo pasa a ser enlace (misma apariencia).
- New design artifact required: no — `DESIGN.md` cubre la pantalla. Estados visuales a manejar: sin selección (hint + CTA `disabled`), variante `Disponible` (badge verde + "{stock} en stock" + CTA habilitado), variante `Agotada` (badge rojo + CTA `disabled`), chip `disabled` (combinación inexistente), chip marcado como agotado, producto sin variantes (nota + CTA `disabled`), 404, layout 2 columnas / apilado.

## Durable Documentation Impact

- `ARCHITECTURE.md`: **update** — documentar la superficie `/productos/[slug]` (RSC async + `force-dynamic` + `notFound`), la frontera de cliente (`product-detail`/`variant-selector` con estado de selección propio; la UI sigue sin tocar Prisma), `src/lib/variants.ts` (lógica derivada de la matriz de variantes), el ancla de try-on en la columna info/compra de la ficha, y **fijar `cart-add` como hito del harness E2E** (corrigiendo "cart-add o product-detail": esta feature es interactiva pero sin mutaciones ni API).
- `CONSTRAINTS.md`: **not needed** — las reglas existentes (Prisma solo desde `src/lib/db`, `formatPrice`, CSS Modules + tokens) ya cubren la implementación; el estado `Disponible`/`Agotada` derivado de `stock` ya está documentado en `docs/domain-model.md` y en `prisma/schema.prisma`.
- `AGENTS.md`: **not needed** — no cambian arranque, gate ni flujo de trabajo.
- Other docs: `docs/domain-model.md`, `docs/technical-discovery.md`, `DESIGN.md`, `CONTEXT.md`, `docs/risks-and-open-questions.md`: **not needed** — el comportamiento coincide con el dominio y la dirección visual existentes; las decisiones de alcance (CTA solo-estado, E2E en `cart-add`) quedan registradas en `ARCHITECTURE.md`.
- `PROGRESS.md`, `feature_list.json`: **update** — evidencia de verificación al cerrar la sesión de implementación.

## Implementation Plan

1. Crear `src/lib/variants.ts` (helpers puros de la matriz sparse: `variantState`, `resolveVariant`, `sizesIn`/`colorsIn`, `isSelectable`, `isSoldOutOption`) y `src/lib/variants.test.ts`; dejarlo en verde.
2. Ampliar `src/lib/catalog.ts` con `ProductVariant`/`CatalogProductDetail` y `getProductDetailBySlug(slug, prisma = db)`; ampliar `src/lib/catalog.test.ts` sobre la base temporal.
3. Implementar `variant-selector.tsx` (+ `.module.css` + test) como componente controlado de chips.
4. Implementar `product-detail.tsx` (`"use client"`, + `.module.css` + test): layout de la ficha, estado de selección con las reglas de chips/limpieza, badge de stock `aria-live`, CTA `disabled` según selección/stock y ancla de try-on comentada.
5. Crear `src/app/productos/[slug]/page.tsx` (RSC async, `await params`, `force-dynamic`, `notFound()`, `generateMetadata`) y `page.test.tsx` (`vi.mock` de `@/lib/catalog` + mock de `next/navigation`).
6. Convertir `product-card.tsx` en enlace a `/productos/[slug]` (`Link`) y actualizar su test.
7. Ejecutar `./init.sh` completo y el smoke runtime (`/productos/camiseta-basica` 200, `/productos/no-existe` 404).
8. Actualizar `ARCHITECTURE.md` (ruta, frontera de cliente, ancla try-on, hito E2E) y cerrar con `feature_list.json` + `PROGRESS.md`.

## Implementation Tasks

- [ ] Crear `src/lib/variants.ts` (helpers puros de la matriz de variantes).
- [ ] Crear `src/lib/variants.test.ts` (orden canónico, selección/limpieza de ejes, agotadas).
- [ ] Ampliar `src/lib/catalog.ts` con `ProductVariant`/`CatalogProductDetail` y `getProductDetailBySlug`.
- [ ] Ampliar `src/lib/catalog.test.ts` (detalle de `camiseta-basica` y `camiseta-estampada`; slug inexistente → `null`).
- [ ] Crear `src/components/variant-selector.tsx` (+ `.module.css`, + test): chips `aria-pressed`, `disabled`, marca de agotado.
- [ ] Crear `src/components/product-detail.tsx` (`"use client"`, + `.module.css`, + test): imagen/descripción/precio, selector, badge `aria-live`, CTA, ancla try-on.
- [ ] Crear `src/app/productos/[slug]/page.tsx` (RSC + `force-dynamic` + `notFound()` + `generateMetadata`).
- [ ] Crear `src/app/productos/[slug]/page.test.tsx` (ficha mockeada + 404).
- [ ] Modificar `src/components/product-card.tsx` (+ test): card enlazada a `/productos/[slug]`.
- [ ] Ejecutar `./init.sh` en verde (sin cambios en el script) + smoke runtime.
- [ ] Actualizar `ARCHITECTURE.md`, `feature_list.json`, `PROGRESS.md`.

## Verification Plan

- `./init.sh` → exit 0 (install + db:setup + lint + typecheck + test + build) con los tests nuevos incluidos; **sin** modificar el script ni arrancar dev servers.
- `pnpm test` → en verde; cobertura nueva mínima:
  - `src/lib/variants.test.ts`: `variantState` (0 → `Agotada`, >0 → `Disponible`); `resolveVariant` (variante exacta y combinación inexistente); opciones solo con valores presentes y orden canónico; `isSelectable` con matriz sparse (`camiseta-basica`: S solo combina con negro → blanco deshabilitado con S fijado); `isSoldOutOption` (S/negro de `camiseta-estampada` marcado como agotado).
  - `src/lib/catalog.test.ts` (base temporal `file:./test-catalog.db`, patrón existente): `getProductDetailBySlug("camiseta-basica")` → nombre/descripción/categoría/precio/imagen + 4 variantes con `size`/`color`/`sku`/`stock`/`priceCents` (`camiseta-basica-S-negro`, stock 12); `getProductDetailBySlug("camiseta-estampada")` incluye la variante agotada (S/negro, stock 0); slug inexistente → `null`.
  - `src/components/variant-selector.test.tsx` (jsdom): chips presentes con `aria-label`; combinaciones inexistentes `disabled`; chip agotado marcado y seleccionable; `onSelect*` al pulsar.
  - `src/components/product-detail.test.tsx` (jsdom): imagen (`alt` = nombre), `h1`, categoría, descripción y precio "19,99 €"; sin selección → hint + CTA `disabled`; seleccionar S/negro en `camiseta-basica` → "Disponible" + "12 en stock" + CTA habilitado; seleccionar S/negro en `camiseta-estampada` → "Agotada" + CTA `disabled`; cambiar de eje con selección incompatible limpia el otro eje.
  - `src/app/productos/[slug]/page.test.tsx` (jsdom): `render(await Page({ params: Promise.resolve({ slug: "camiseta-basica" }) }))` renderiza la ficha mockeada; slug desconocido invoca `notFound` (mock de `next/navigation`).
  - `src/components/product-card.test.tsx` (ampliado): la card enlaza a `/productos/camiseta-basica`.
  - Confirmar en el resumen de `pnpm test` que el test bajo la carpeta `[slug]` se ejecuta (ver Risks).
- `pnpm lint`, `pnpm typecheck`, `pnpm build` → exit 0; en el build, `/productos/[slug]` aparece como ruta dinámica (ƒ).
- Smoke runtime (`pnpm dev`, servidor detenido tras la comprobación): `GET /productos/camiseta-basica` → HTTP 200 con "Camiseta básica", "Camisetas" y "19,99"; `GET /productos/no-existe` → HTTP 404.
- **E2E**: no hay comando E2E persistente (`pnpm test:e2e` no existe; sin Playwright/Cypress) y **no se introduce en esta feature**, pese a que `ARCHITECTURE.md` la citaba como posible primer flujo mutante: la selección de variante es estado de cliente, sin escrituras, sin API y sin navegación mutante; el primer flujo mutante real es `cart-add`, donde se introducirá el harness. La cobertura automatizada (helpers puros + componentes jsdom + consulta real sobre base temporal) y la verificación visual del validator cubren el contrato de esta feature. Se actualiza `ARCHITECTURE.md` para fijar `cart-add` como hito E2E (corrección de "cart-add o product-detail").
- **Verificación visual obligatoria (Chrome DevTools MCP, solo el validator — ni el planner ni el implementer la ejecutan)**, con base sembrada (`./init.sh` o `pnpm db:setup`) y `pnpm dev` en marcha:
  - `navigate_page` `http://localhost:3000/` → `take_snapshot`: cada card enlaza a `/productos/<slug>`.
  - `navigate_page` `http://localhost:3000/productos/camiseta-basica` → `take_snapshot`: `h1` "Camiseta básica", "Camisetas", descripción, "19,99 €", chips de talla S/M/L/XL y color negro/blanco/azul/rojo, hint "Selecciona talla y color…", CTA "Añadir al carrito" `disabled`.
  - Interacción (click en los chips): seleccionar talla "S" y color "negro" → `take_snapshot`: badge "Disponible" y "12 en stock", CTA habilitado.
  - Desktop 1280×800 (`resize_page`/`emulate`): `take_screenshot` → `docs/evidence/product-detail-desktop-1280.png` (dos columnas: imagen | info).
  - Móvil 375×667 (`emulate`/`resize_page`): `take_snapshot` + `take_screenshot` → `docs/evidence/product-detail-mobile-375.png` (ficha apilada).
  - `navigate_page` `http://localhost:3000/productos/camiseta-estampada` → seleccionar "S" + "negro" → `take_snapshot`: badge "Agotada" y CTA `disabled`; `take_screenshot` → `docs/evidence/product-detail-agotada-desktop-1280.png`.
  - `navigate_page` `http://localhost:3000/productos/no-existe` → `take_snapshot` de la 404 (captura opcional).
  - `list_console_messages` en las rutas visitadas: sin errores nuevos (en particular sin 404 de `/images/products/*.svg`).
- `init.sh`: no cambia; sigue siendo el gate **no bloqueante** estándar (install + db:setup + lint + typecheck + test + build) y **no** arranca servicios de larga vida.

## Evidence To Capture

- Salida de `pnpm test` con los nombres de los tests nuevos (`src/lib/variants.test.ts`, `src/lib/catalog.test.ts` ampliado, `src/components/variant-selector.test.tsx`, `src/components/product-detail.test.tsx`, `src/app/productos/[slug]/page.test.tsx`, `src/components/product-card.test.tsx`).
- Salida de `./init.sh` (exit 0, pasos sin cambios) y de `pnpm lint` / `pnpm typecheck` / `pnpm build` (ruta dinámica `/productos/[slug]`).
- Resultado del smoke runtime (`/productos/camiseta-basica` → 200; `/productos/no-existe` → 404).
- Resumen del `take_snapshot` de la ficha (campos visibles, selección S/negro → "Disponible · 12 en stock", `camiseta-estampada` S/negro → "Agotada" + CTA `disabled`) y rutas de las capturas del validator: `docs/evidence/product-detail-desktop-1280.png`, `docs/evidence/product-detail-mobile-375.png`, `docs/evidence/product-detail-agotada-desktop-1280.png`, más el resultado de `list_console_messages` (sin errores).
- Registrar todo en `feature_list.json` (campo `evidence`) y `PROGRESS.md`.

## Risks And Open Questions

- **Matriz de variantes sparse del seed** (medio): solo existen 3–4 combinaciones talla×color por producto (p. ej. `camiseta-basica` no tiene S/blanco). Un selector ingenuo mostraría variantes fantasma. Mitigación obligatoria en el spec: helpers `isSelectable`/`isSoldOutOption` en `src/lib/variants.ts` con tests (Scenario 4).
- **Test en la carpeta `[slug]`** (bajo): los corchetes del segmento dinámico podrían no casar con el glob de Vitest (`**/*.test.*`). Mitigación: comprobar en el resumen de `pnpm test` que `src/app/productos/[slug]/page.test.tsx` se ejecuta; si no, ampliar `include` en `vitest.config.ts` (desviación acotada a registrar, como la de `catalog-list`).
- **CTA "Añadir al carrito" sin acción** (bajo): un validator podría leer el botón habilitado que no añade nada como bug. Decisión de alcance explícita: su contrato es solo el estado `disabled` (Non-Goals + Validator Checklist); la acción es de `cart-add`.
- **Primer componente `"use client"` del repo** (bajo): mantener la frontera — el RSC consulta y pasa el DTO al cliente; Prisma no debe filtrarse al cliente (CONSTRAINTS: acceso a datos solo vía `src/lib`).
- **Idioma de la UI** (preexistente, sin bloqueo): asumido español en los textos de esta feature, igual que `catalog-list`.
- Sin ambigüedades bloqueantes: ruta (`/productos/[slug]`), estados (`Disponible`/`Agotada` derivados de `stock`), precio mostrado (el de la variante resuelta si la hay, si no el base; coinciden en el seed) y ancla try-on (solo punto de montaje comentado, sin UI) quedan decididos en este spec.

## Validator Checklist

- [ ] La implementación se mantiene dentro del alcance de `product-detail` (ficha + selector de variante + estados de stock; sin carrito/checkout, sin try-on, sin filtros/ordenación, sin header/nav/chatbot, sin harness E2E).
- [ ] Los 6 escenarios de aceptación pasan (ficha completa; variante correcta con su stock; agotada visible y no comprable; combinaciones inexistentes no seleccionables; 404 por slug; `./init.sh` en verde).
- [ ] El botón "Añadir al carrito" **no añade nada al carrito** (fuera de alcance; es `cart-add`); su contrato aquí es solo el estado `disabled` ante variante agotada o sin selección válida.
- [ ] El estado `Disponible`/`Agotada` se deriva de `stock` (sin campos ni migraciones nuevas) y usa `formatPrice` para el precio.
- [ ] El detalle se lee de SQLite vía `src/lib/catalog` (`getProductDetailBySlug`, cliente inyectable) y los chips respetan la matriz sparse (sin resolver variantes inexistentes).
- [ ] Evidencia visual con Chrome DevTools MCP capturada por el validator: snapshots + `docs/evidence/product-detail-{desktop-1280,mobile-375,agotada-desktop-1280}.png` + `list_console_messages` limpio.
- [ ] La justificación de no-E2E se acepta y la corrección del hito E2E (`cart-add`) quedó registrada en `ARCHITECTURE.md`.
- [ ] `feature_list.json` y `PROGRESS.md` fueron actualizados correctamente (evidencia incluida).
- [ ] No se añadió trabajo de features posteriores ni comportamiento no solicitado.

## Implementation Findings (implementer)

- **Tensión interna del Scenario 4 (reglas 4a vs 4c)**: con el `disabled` simétrico de la regla 4a (un chip incompatible con la selección del otro eje queda `disabled`), el ejemplo de limpieza de 4c ("color blanco y después talla S") **no es alcanzable por UI**: al fijar color blanco, el chip de talla S aparece `disabled` y no se puede pulsar, así que nunca se dispara la limpieza. Resolución acotada y sin cambio de alcance:
  - se mantiene el `disabled` nativo simétrico de 4a (es la regla explícita y el comportamiento UX principal; los chips sin combinación no se pueden seleccionar);
  - la regla de limpieza 4c se extrae a un helper puro `nextSelection(variantes, selección, eje, valor)` en `src/lib/variants.ts` y se cubre con tests unitarios en `src/lib/variants.test.ts` (incluye el caso S/blanco en ambos sentidos);
  - el test de UI en `product-detail.test.tsx` verifica que las combinaciones inexistentes quedan `disabled` (parte alcanzable del Scenario 4) en lugar de simular un click imposible sobre un chip `disabled`.
  - No se cambia ningún escenario de aceptación observable: en ningún caso se resuelve una variante inexistente.
- **`vitest.config.ts` no requirió cambios**: el test bajo la carpeta `[slug]` (`src/app/productos/[slug]/page.test.tsx`) se recoge con el `include` por defecto de Vitest (`**/*.test.*`); verificado en la salida de `pnpm test` (9 archivos). No se tocó el patrón.
- El resto del plan (ruta con `await params` + `force-dynamic` + `notFound()` + `generateMetadata`, DTOs y `getProductDetailBySlug` con cliente inyectable, helpers de variantes, chips con `aria-pressed`/`role=group`/marca de agotado, badge `aria-live`, CTA solo-estado sin handler, card como `Link`, layout 2 columnas/stack) se implementó tal cual.

