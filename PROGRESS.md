# Registro de progreso

## Estado verificado actual

- Raíz del repositorio: `/Users/juan/Documents/EDICION-5/harness/ai-expert-project`
- Ruta estándar de arranque: `./init.sh`
- Ruta estándar de verificación: `./init.sh` (gate: install + db:setup + lint + typecheck + test + build; asegura `.env`; no bloqueante, sin dev servers)
- Arranque local: `pnpm dev`
- Siguiente paso: `catalog-filter` (prerequisito `catalog-list` en `accepted`); requiere rol `planner`.
- Bloqueador actual: ninguno
- Última verificación: `./init.sh` en verde (exit 0) durante la validación independiente de `catalog-list` (`accept`), 2026-10-06

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
