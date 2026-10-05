# Registro de progreso

## Estado verificado actual

- Raíz del repositorio: `/Users/juan/Documents/EDICION-5/harness/ai-expert-project`
- Ruta estándar de arranque: `./init.sh`
- Ruta estándar de verificación: `./init.sh` (gate: install + db:setup + lint + typecheck + test + build; asegura `.env`; no bloqueante, sin dev servers)
- Arranque local: `pnpm dev`
- Siguiente feature lista: `catalog-filter` (prerequisito `catalog-list` en `accepted`); alternativas listas: `catalog-sort` y `product-detail` (mismo prerequisito)
- Bloqueador actual: ninguno
- Última verificación: `catalog-list` en `accepted` (validación independiente `feature-validator` veredicto `accept`): `./init.sh` en verde, `pnpm test` 12/12, recorrido manual `/` HTTP 200 con 8 productos; 2026-10-05

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

- Fecha: 2026-10-05
- Objetivo: que la home (`/`) muestre el catálogo real (base Prisma) como cuadrícula responsive de tarjetas con imagen, nombre, categoría y precio; introducir la capa `src/lib` de acceso a datos.
- Completado:
  - Capa de datos: `src/lib/db.ts` (singleton `PrismaClient` con guard en `globalThis` para HMR), `src/lib/catalog.ts` (`getCatalogProducts`, `orderBy: { createdAt: "desc" }`, `include: { category: true }`; tipo `CatalogProduct` mínimo) y `src/lib/format.ts` (`formatPriceCents` con `Intl.NumberFormat("es-ES")`).
  - Presentación: `src/components/ProductCard.tsx` (imagen `next/image unoptimized` con `alt` = nombre, `h2` nombre, categoría muted, precio formateado; sin enlaces ni badges) y `src/components/ProductGrid.tsx` + `ProductGrid.module.css` (`<ul>` grid 2/3/4 columnas en <640/≥640/≥1024 y estado vacío "No hay productos disponibles en este momento.").
  - Estilos: `src/app/globals.css` (custom properties de `DESIGN.md` + tipografía base) importado desde `layout.tsx`. Sin Tailwind.
  - Home: `src/app/page.tsx` ahora es server component `async` con `export const dynamic = "force-dynamic"`, `<main className="container">`, `h1` "Catálogo" y `ProductGrid`.
  - Tests: `src/lib/catalog.test.ts` (integración node sobre base temporal `prisma/test-catalog.db`), `src/components/ProductGrid.test.tsx` (jsdom, 2 tests) y `src/app/page.test.tsx` adaptado (mock de `getCatalogProducts`).
- Verificación ejecutada y evidencia:
  - `pnpm test` -> exit 0; 12 tests en 4 archivos (catalog-list: 3 integración + 2 grid + 1 página; seed: 6 sin regresión).
  - `pnpm lint` -> exit 0; `pnpm typecheck` -> exit 0.
  - `pnpm build` -> exit 0; `/` marcada como dinámica (ƒ) por `force-dynamic`.
  - `./init.sh` -> exit 0 (install + asegura `.env` + db:setup + lint + typecheck + test + build; sin dev servers).
  - `pnpm db:setup` -> 3 categorías, 8 productos, 29 variantes.
  - Manual `pnpm dev` + GET `/` -> HTTP 200: h1 "Catálogo", "Camiseta básica" · "Camisetas" · "19,99"; 8 imágenes `/images/products/*.svg`; 0 enlaces de producto; sin estado vacío con base poblada. Servidor detenido (0 procesos node).
  - Responsive en CSS compilado: base `repeat(2, 1fr)`; `@media (min-width: 640px)` -> 3; `@media (min-width: 1024px)` -> 4.
- Archivos o artefactos actualizados: `src/lib/{db,catalog,format}.ts`, `src/lib/catalog.test.ts`, `src/components/{ProductCard,ProductGrid}.tsx`, `src/components/ProductGrid.module.css`, `src/components/ProductGrid.test.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/page.test.tsx`, `ARCHITECTURE.md`, `CONSTRAINTS.md`, `feature_list.json`, `PROGRESS.md`.
- Riesgo o cuestión no resuelta: E2E persistente no introducido (justificado en el spec: no existe `pnpm test:e2e`; superficie de solo lectura cubierta por integración + render). La afirmación de columnas por breakpoint se verifica sobre el CSS compilado (los media queries), no con un navegador real. `PROGRESS.md` conserva la "Raíz del repositorio" de otra máquina (dato heredado, fuera de alcance).
- Estado: feature `catalog-list` en `accepted` (validación independiente vía `feature-validator`: veredicto `accept`; reverificó gate, base sembrada, `/` HTTP 200, CSS responsive y scope disciplinado).
- Siguiente mejor paso: `catalog-filter`, `catalog-sort` o `product-detail` (prerequisito `catalog-list` ya `accepted`; reevaluar harness E2E en el primero con flujo interactivo).
