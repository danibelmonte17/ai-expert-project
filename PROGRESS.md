# Registro de progreso

## Estado verificado actual

- Raíz del repositorio: `/Users/juan/Documents/EDICION-5/harness/ai-expert-project`
- Ruta estándar de arranque: `./init.sh`
- Ruta estándar de verificación: `./init.sh` (gate: install + db:setup + lint + typecheck + test + build; asegura `.env`; no bloqueante, sin dev servers)
- Arranque local: `pnpm dev`
- Siguiente paso: `catalog-filter` (prerequisito `catalog-list` en `accepted`); requiere rol `planner`. (`catalog-sort` comparte prerequisito y también está listo.)
- Bloqueador actual: ninguno
- Última verificación: `./init.sh` en verde (exit 0) durante la validación independiente de `product-detail` (`accept`), 2026-10-06

## Registro de sesión

### Sesión 001

- Fecha: 2026-08-26
- Objetivo: Crear el harness inicial mínimo del repositorio.
- Completado: `AGENTS.md`, `init.sh`, `PROGRESS.md` y `feature_list.json` creados.
- Verificación ejecutada: validación JSON de `feature_list.json`; comprobación de dependencias (referencias válidas, sin ciclos, sin auto-referencias).
- Evidencia capturada: 19 features sesionables, sin features en estado `in_progress`, sin epic/milestone sin trocear.
- Archivos o artefactos actualizados: `AGENTS.md`, `init.sh`, `PROGRESS.md`, `feature_list.json`.
- Riesgo o cuestión no resuelta: el stack aún no está inicializado; `init.sh` es provisional hasta el bootstrap técnico.
- Siguiente mejor paso: ejecutar la feature `bootstrap-stack` (Next.js + TypeScript + SQLite + pnpm con gate de lint/typecheck/tests).

### Sesión 002 — `bootstrap-stack`

- Fecha: 2026-08-26
- Objetivo: dejar el repo arrancando como app Next.js/TypeScript con pnpm, gate de calidad desde `./init.sh` y persistencia (SQLite + Prisma) cableada de forma mínima.
- Completado:
  - Scaffold manual de Next.js 15 (App Router) + TypeScript: `package.json`, `tsconfig.json`, `eslint.config.mjs`, `next.config.ts`, `next-env.d.ts`, `src/app/layout.tsx`, `src/app/page.tsx`.
  - Testing con Vitest + Testing Library + jsdom: `vitest.config.ts`, `vitest.setup.ts`, `src/app/page.test.tsx` (1 test de humo).
  - ORM Prisma 6 + SQLite: `prisma/schema.prisma` (datasource + generator, sin modelos), `.env` (no commiteado), `.env.example` (commiteado, con `DATABASE_URL` y hueco para `DEVEXPERT_API_KEY`).
  - `.npmrc` con `public-hoist-pattern[]=*` (para que ESLint flat config resuelva los plugins bajo pnpm) y `pnpm.onlyBuiltDependencies` en `package.json` (build scripts de esbuild/prisma/engines).
  - `init.sh` reescrito a gate real no bloqueante (node/pnpm check → install → lint → typecheck → test → build).
- Verificación ejecutada y evidencia:
  - `pnpm install` → OK (next 15.5.24, react 19.2.8, prisma 6.19.3, vitest 3.2.7; lockfile generado).
  - `pnpm lint` → exit 0.
  - `pnpm typecheck` → exit 0.
  - `pnpm test` → exit 0 (1 test).
  - `pnpm build` → exit 0.
  - `pnpm exec prisma validate` → exit 0.
  - `./init.sh` → exit 0.
  - `pnpm dev` → home responde HTTP 200 ("Tienda de ropa"); proceso detenido tras la comprobación.
- Archivos o artefactos actualizados: `AGENTS.md` (sección "Stack y verificación estándar"), `ARCHITECTURE.md` (nuevo), `CONSTRAINTS.md` (nuevo), `docs/technical-discovery.md` (decisión ORM), `docs/risks-and-open-questions.md` (research task ORM resuelta), `feature_list.json`, `PROGRESS.md`, `.gitignore`.
- Riesgo o cuestión no resuelta: `@prisma/client` aún sin `prisma generate` (sin modelos; se generará el cliente en `bootstrap-seed` cuando existan modelos). Build scripts de `@prisma/client` ignorados por pnpm a propósito (no necesarios aún).
- Estado: feature `bootstrap-stack` en `accepted` (validación independiente vía `feature-validator`: veredicto `accept`).
- Siguiente mejor paso: validación independiente de `bootstrap-stack`; después, feature `bootstrap-seed` (modelo de datos + seed del catálogo).

### Sesión 003 — `bootstrap-seed`

- Fecha: 2026-10-05
- Objetivo: definir el modelo de datos completo en Prisma, crear las migraciones SQLite, un seed idempotente del catálogo y dejar la base poblada desde la ruta estándar de arranque.
- Completado:
  - `prisma/schema.prisma`: 10 modelos (`Category`, `Product`, `Variant`, `User`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat`, `TryonImage`) con relaciones, `@@unique`/`@@index`, `onDelete: Cascade`; dinero en centavos (`Int`), estados como `String` documentado, sin `Json` ni blobs.
  - Migración `prisma/migrations/20261005182634_init_catalog/migration.sql` + `migration_lock.toml` (commiteables).
  - `prisma/seed.ts`: catálogo idempotente (3 categorías, 8 productos, 29 variantes; 4 tallas, 4 colores; 19,99–119,99 €; 2 agotadas; 6 productos 100% en stock; `createdAt` escalonado; `imageUrl` local), resumen y autoverificación (falla si no se cumplen mínimos). Carga `.env` en runtime con `process.loadEnvFile`.
  - `public/images/products/*.svg`: 8 placeholders locales.
  - `prisma/seed.test.ts`: 6 tests sobre base temporal (`prisma/test-seed.db`, limpiada al final).
  - `package.json`: scripts `postinstall` (`prisma generate`), `db:seed` (`tsx prisma/seed.ts`), `db:setup` (`prisma migrate deploy && pnpm db:seed`) y devDep `tsx` 4.23.15.
  - `init.sh`: asegura `.env` (copia de `.env.example`) y ejecuta `pnpm db:setup` entre install y lint; sin dev servers.
- Verificación ejecutada y evidencia:
  - `pnpm install` → OK; `postinstall` ejecuta `prisma generate` → cliente tipado.
  - `pnpm exec prisma validate` → exit 0.
  - `pnpm exec prisma migrate dev --name init_catalog` → migración `20261005182634_init_catalog`; `migration.sql` con `CREATE TABLE` de las 10 tablas.
  - `pnpm db:setup` → exit 0; resumen: 3 categorías, 8 productos, 29 variantes, 4 tallas, 4 colores, precios 1999-11999, 2 agotadas, 6 productos 100% en stock.
  - `pnpm db:seed` (2ª ejecución) → mismos conteos (idempotente).
  - `pnpm test` → exit 0 (7 tests: 6 de seed + 1 de la home).
  - `pnpm lint` / `pnpm typecheck` / `pnpm build` → exit 0.
  - `./init.sh` → exit 0 en checkout limpio (sin `.env` ni `prisma/dev.db`): crea `.env`, install, db:setup, lint, typecheck, test, build; deja `prisma/dev.db` poblado; sin dev servers.
- Archivos o artefactos actualizados: `prisma/schema.prisma`, `prisma/migrations/**`, `prisma/seed.ts`, `prisma/seed.test.ts`, `public/images/products/*.svg`, `package.json`, `init.sh`, `ARCHITECTURE.md`, `CONSTRAINTS.md`, `AGENTS.md`, `docs/risks-and-open-questions.md`, `feature_list.json`, `PROGRESS.md`.
- Riesgo o cuestión no resuelta: `@prisma/client` no resuelve `.env` de forma fiable cuando el cliente se genera antes de existir `.env` (checkout limpio); mitigado cargando `.env` explícitamente en el seed. La advertencia de Next sobre múltiples lockfiles proviene del árbol de worktrees, no de esta feature.
- Estado: feature `bootstrap-seed` en `passing` (pendiente de validación independiente).
- Siguiente mejor paso: validación independiente de `bootstrap-seed`; después, feature `catalog-list`.

### Sesión 004 — `catalog-list`

- Fecha: 2026-10-06
- Objetivo: mostrar el catálogo como primera pantalla de producto en `/`: grid responsive de cards (imagen, nombre, categoría, precio) leyendo SQLite en runtime, e introducir la capa `src/lib` (Prisma singleton + consultas + formato) y la convención de estilos (CSS Modules + tokens de `DESIGN.md`).
- Completado:
  - `src/lib/db.ts`: singleton `PrismaClient` en `globalThis` (única puerta a Prisma desde `src/`).
  - `src/lib/catalog.ts`: `listCatalogProducts(prisma = db)` → DTO `{ id, slug, name, imageUrl, priceCents, currency, categoryName }` con `include: { category: true }` y orden `createdAt` desc; cliente inyectable.
  - `src/lib/format.ts`: `formatPrice(priceCents, currency)` con `Intl.NumberFormat("es-ES")`.
  - `src/lib/catalog.test.ts`: test de integración en entorno `node` sobre base temporal `prisma/test-catalog.db` (migrate deploy + `seedCatalog`, limpieza al final); 3 tests.
  - `src/app/globals.css` con tokens de `DESIGN.md` (variables CSS) e importado en `src/app/layout.tsx`.
  - `src/components/product-card.tsx` (+ `.module.css`, + test jsdom): `<img alt=nombre>` con `aspect-ratio 1/1`/`object-fit: contain`, nombre, categoría y precio formateado; sin enlace.
  - `src/components/product-grid.tsx` (+ `.module.css`, + test jsdom): `main` + `h1` "Catálogo" + `ul`/`li`, grid 2 columnas (base) / 3 (≥768px) / 4 (≥1200px), estado vacío "No hay productos disponibles.".
  - `src/app/page.tsx`: RSC `async` + `export const dynamic = "force-dynamic"`; `src/app/page.test.tsx` reescrito con `vi.mock` de `src/lib/catalog` (listado + estado vacío).
  - `vitest.config.ts` (desviación del spec): alias `@/* → ./src/*` (Vitest no lee los `paths` de tsconfig) y `afterEach(cleanup)` explícito en los tests jsdom (Vitest sin `globals: true` no auto-limpia). Sin dependencias nuevas.
- Verificación ejecutada y evidencia:
  - `pnpm test` → exit 0; 5 archivos / 14 tests (nuevos: `catalog.test.ts` 3, `product-card.test.tsx` 1, `product-grid.test.tsx` 2, `page.test.tsx` 2).
  - `pnpm lint` → exit 0; `pnpm typecheck` → exit 0.
  - `pnpm build` → exit 0; `/` marcada Dynamic (ƒ) por `force-dynamic`.
  - `./init.sh` → exit 0 (install + db:setup + lint + typecheck + test + build; sin dev servers; script sin cambios). Nota de entorno: en este sandbox Windows `bash`/`pnpm` no estaban en la ruta de Git Bash; se ejecutó con un wrapper temporal `.tmp-tools/pnpm` (eliminado después), sin tocar el repo.
  - Smoke runtime: `pnpm dev` + `GET http://localhost:3000/` → HTTP 200 con h1 "Catálogo", "Camiseta básica", "Camisetas", "19,99" y las 8 imágenes de producto; servidor detenido.
- Archivos o artefactos actualizados: `src/lib/{db,catalog,format}.ts`, `src/lib/catalog.test.ts`, `src/components/*`, `src/app/{globals.css,layout.tsx,page.tsx,page.test.tsx}`, `vitest.config.ts`, `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/specs/catalog-list.md` (Implementation Findings), `feature_list.json`, `PROGRESS.md`.
- Riesgo o cuestión no resuelta: ninguno bloqueante; `404 /favicon.ico` (preexistente) es cosmético y queda fuera de alcance.
- Validación independiente (`feature-validator`, 2026-10-06): veredicto `accept`.
  - Reverificó `pnpm lint`/`pnpm typecheck`/`pnpm test` (5 archivos / 14 tests) y `./init.sh` (exit 0).
  - Verificación visual en navegador real (Chrome 154 vía DevTools Protocol; el MCP `chrome-devtools` no estaba expuesto en el runtime del validator): h1 "Catálogo", 8 cards con `img[alt=nombre]`/nombre/categoría/precio en €, orden `createdAt` desc; grid **4 columnas** a 1280×800 y **2 columnas** a 375×667; sin 404 de `/images/products/*.svg`. Capturas: `docs/evidence/catalog-list-desktop-1280.png`, `docs/evidence/catalog-list-mobile-375.png`.
  - Alcance, arquitectura y documentación durables conformes; desviación de `vitest.config.ts` (alias `@` + cleanup explícito) juzgada justificada y en alcance. Hallazgos Low/Informativos no bloqueantes.
- Estado: feature `catalog-list` en `accepted` (validación independiente: `accept`).
- Siguiente mejor paso: feature `catalog-filter` (prerequisito `catalog-list` en `accepted`); requiere rol `planner`.

### Sesión 005 — `product-detail`

- Fecha: 2026-10-06
- Objetivo: mostrar la ficha de cada producto en `/productos/[slug]` (imagen, descripción, categoría, precio) con un selector talla/color que resuelve la variante real de la matriz sparse y muestra su estado/stock (`Disponible`/`Agotada`), leyendo SQLite en runtime; enlazar las cards del catálogo y dejar el ancla de try-on y el CTA "Añadir al carrito" (solo estado).
- Completado:
  - `src/lib/variants.ts` (nuevo): helpers puros `variantState`, `resolveVariant`, `sizesIn`/`colorsIn` (orden canónico filtrado a presentes), `isSelectable`, `isSoldOutOption` y `nextSelection` (limpieza del otro eje); sin Prisma.
  - `src/lib/catalog.ts`: DTOs `ProductVariant`/`CatalogProductDetail` + `getProductDetailBySlug(slug, prisma = db)` (`include` categoría + variantes, cliente inyectable; `null` si no existe).
  - `src/components/variant-selector.tsx` (+ `.module.css`, + test): chips píldora controlados, `role="group"` + `aria-label` Talla/Color, `aria-pressed`, `disabled` en combinaciones inexistentes, marca de agotado (`data-sold-out`, `--color-danger`) pero seleccionable.
  - `src/components/product-detail.tsx` (+ `.module.css`, + test): primer `"use client"` del repo; imagen (`alt`=nombre), `h1`, categoría, descripción, precio con `formatPrice` de la variante resuelta, badge de stock `aria-live` (`Disponible` verde / `Agotada` rojo), CTA "Añadir al carrito" `disabled` salvo variante válida en stock y sin handler, nota/CTA para producto sin variantes, layout 1 columna (móvil) / 2 columnas (≥768px) y ancla try-on comentada.
  - `src/app/productos/[slug]/page.tsx` (+ test): RSC `async` + `force-dynamic` + `await params` (Next 15) + `notFound()` + `generateMetadata` (title = nombre).
  - `src/components/product-card.tsx` (+ test): la card entera pasa a `Link` a `/productos/${slug}`.
- Verificación ejecutada y evidencia:
  - `pnpm test` → exit 0; **9 archivos / 44 tests** (nuevos: `variants.test.ts` 13, `catalog.test.ts` +3, `variant-selector.test.tsx` 5, `product-detail.test.tsx` 6, `page.test.tsx` 2, `product-card.test.tsx` +1). Confirmado que `src/app/productos/[slug]/page.test.tsx` SÍ se recoge → `vitest.config.ts` sin cambios.
  - `pnpm lint` → exit 0; `pnpm typecheck` → exit 0.
  - `pnpm build` → exit 0; `/productos/[slug]` como ruta dinámica (ƒ).
  - `./init.sh` → exit 0 (install + db:setup + lint + typecheck + test + build; sin dev servers; script sin cambios). En este sandbox Windows se ejecutó con Git Bash (`C:\Program Files\Git\bin\bash.exe`); `bash` del PATH apunta al stub de WSL sin distro.
  - Smoke runtime (`pnpm exec next dev -p 3100`, servidor detenido; el puerto 3000 lo ocupaba el worktree `catalog-filter`): `/productos/camiseta-basica` → HTTP 200 con "Camiseta básica", "Camisetas", "19,99", hint y grupos Talla/Color + CTA; `/` con card `href="/productos/camiseta-basica"`; `/productos/no-existe` → HTTP 404.
- Archivos o artefactos actualizados: `src/lib/{variants.ts,variants.test.ts,catalog.ts,catalog.test.ts}`, `src/components/{variant-selector.tsx,variant-selector.module.css,variant-selector.test.tsx,product-detail.tsx,product-detail.module.css,product-detail.test.tsx,product-card.tsx,product-card.module.css,product-card.test.tsx}`, `src/app/productos/[slug]/{page.tsx,page.test.tsx}`, `ARCHITECTURE.md`, `docs/specs/product-detail.md` (Implementation Findings), `feature_list.json`, `PROGRESS.md`.
- Desviación / hallazgo: el ejemplo de limpieza del Scenario 4 ("color blanco y después talla S") no es alcanzable por UI con el `disabled` simétrico de la regla 4a (el chip S queda `disabled`); se mantiene el `disabled` y la limpieza se extrae a `nextSelection` con test unitario, y el test de UI verifica las combinaciones inexistentes `disabled`. Registrado en `docs/specs/product-detail.md`. Sin cambios en `prisma/*`, `init.sh`, `package.json` ni `vitest.config.ts`.
- Validación independiente (`feature-validator`, 2026-10-06): veredicto `accept` (registro en `docs/validations/product-detail.md`).
  - Reverificó `pnpm lint`/`pnpm typecheck`/`pnpm test` (9 archivos / 44 tests), `pnpm build` (`/productos/[slug]` dinámica ƒ; `/_not-found` estática; `/` dinámica) y `./init.sh` (exit 0); smoke runtime `/productos/camiseta-basica` 200, `/` 200 (8 enlaces), `/productos/no-existe` 404.
  - Verificación visual (MCP `chrome-devtools` no expuesto → fallback documentado: Chrome real headless vía DevTools Protocol, dev en puerto 3200): ficha con h1/categoría/descripción/"19,99 €"/Talla S,M,L,XL/Color negro,blanco,azul,rojo/hint/CTA `disabled`; S+negro → "Disponible · 12 en stock" + CTA habilitado; fijar S deshabilita blanco/azul/rojo (matriz sparse, sin variantes fantasma); `camiseta-estampada` S+negro → "Agotada" + CTA `disabled`; `/productos/no-existe` → 404. Capturas: `docs/evidence/product-detail-{desktop-1280,mobile-375,agotada-desktop-1280}.png`. Consola: solo `favicon.ico` (preexistente) y el 404 intencional; sin 404 de `/images/products/*.svg`.
  - Checklist del spec: todos los ítems pasan. Hallazgos Low no bloqueantes (L1 tensión 4a/4c documentada; L2 favicon preexistente; I1 warning de lockfiles ambiental). Seguridad y arquitectura conformes (Prisma solo vía `src/lib/db`; `findUnique` parametrizado; sin secretos ni dependencias nuevas).
- Estado: feature `product-detail` en `accepted` (validación independiente: `accept`).
- Siguiente mejor paso: feature `catalog-filter` (prerequisito `catalog-list` en `accepted`); requiere rol `planner`. `catalog-sort` también está listo si se prefiere.
