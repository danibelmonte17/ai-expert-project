# Architecture

## Runtime Surface

Monolito simple sobre **Next.js (App Router)** en TypeScript. Una única app sirve tanto el frontend (React Server Components / páginas) como el backend (API routes / server actions) sin procesos separados.

- **Framework**: Next.js 15 (App Router, `src/app`).
- **Lenguaje**: TypeScript (estricto).
- **Gestor de paquetes**: pnpm (lockfile commiteado).
- **Persistencia**: SQLite vía **Prisma** (sin servicio externo; un único archivo de base de datos local).
- **API routes**: primera superficie en `src/app/api/ai/status` (`GET` → 200 `{ configured, message }`), una sonda de la degradación de IA; el resto de superficies HTTP llegan con las features de chatbot/try-on.

## Layers

1. **UI / páginas** — `src/app/*` (rutas y layouts) y `src/components/*` (componentes presentacionales, puros y sin Prisma). El listado de catálogo vive en `src/app/page.tsx` (RSC async + `force-dynamic`), que delega en `ProductGrid`/`ProductCard`.
2. **Acceso a datos y presentación** — `src/lib/*` (introducida por `catalog-list`): `db.ts` es el único punto que instancia `PrismaClient` (singleton en `globalThis` para sobrevivir al HMR en dev); `catalog.ts` expone las consultas de catálogo (`listCatalogProducts`, orden `createdAt` desc, cliente inyectable); `format.ts` centraliza la presentación de dinero (`formatPrice`). Las páginas no usan Prisma directamente.
3. **Acceso a IA** — `src/lib/ai/*` (introducida por `ai-provider-config`): `config.ts` lee proveedor/modelo **solo** de env (`DEVEXPERT_API_KEY`, `AI_BASE_URL`, `AI_CHAT_MODEL`, `AI_IMAGE_EDIT_MODEL`, `AI_EMBEDDING_MODEL`) en runtime, con defaults documentados; `client.ts` es la única puerta al SDK `openai` (`createAiClient`); `errors.ts` define el contrato `AiResult<T>` (éxito/error con `ai_disabled`/`ai_quota`/`ai_error`), el copy `AI_MESSAGES` en español y `normalizeAiError` (429 → `ai_quota`); `index.ts` expone `getAiStatus()`, `chatCompletion()` e `imageEdit()` como transporte + normalización (sin prompts de dominio, sin contexto de catálogo y sin persistencia). Sin clave, todo degrada con `ai_disabled` sin construir cliente ni hacer red.
4. **Persistencia** — Prisma (`prisma/schema.prisma`) sobre SQLite. Modelo completo definido (10 tablas): `Category`, `Product`, `Variant`, `User`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat` y `TryonImage`. Las migraciones viven commiteadas en `prisma/migrations/` (`<timestamp>_init_catalog`). El catálogo de ejemplo se carga con un seed idempotente (`prisma/seed.ts`, `pnpm db:seed`) que hace upserts por `slug`/`sku`. `prisma generate` se ejecuta en `postinstall`, de modo que `pnpm install` deja el cliente tipado. Convenciones: dinero en **centavos** (`priceCents`, `unitPriceCents`, `totalCents`); estados como `String` con valores documentados (SQLite no soporta enums); sin campos `Json` ni blobs (historial de chat como `String` serializado, imágenes solo como referencias).
5. **Configuración de entorno** — `.env` (local, no commiteado; `./init.sh` lo crea desde `.env.example` si falta) y `.env.example` (commiteado). Claves de IA vía variables de entorno.

## Dependency Direction

`src/app` → `src/components` + `src/lib` (`catalog.ts` → `db.ts`; `ai/index.ts` → `ai/client.ts` → SDK `openai`) → Prisma (`@prisma/client`) → SQLite. `src/lib/ai` → gateway DevExpert (`inference.devexpert.io`), opcional.

No hay dependencia inversa ni servicios externos obligatorios para arrancar. La dependencia de IA es opcional: sin `DEVEXPERT_API_KEY` la app arranca y degrada.

## Decisions

- **ORM**: Prisma (v6) con SQLite, decisión tomada en `bootstrap-stack`. `DATABASE_URL="file:./dev.db"` (relativa a `prisma/`). Alternativa evaluada: Drizzle; descartada por familiaridad y tooling de migraciones integrado de Prisma.
- **Migraciones y seed**: migraciones SQL commiteadas en `prisma/migrations/` (generadas con `prisma migrate dev`); `pnpm db:setup` = `prisma migrate deploy` + `pnpm db:seed`. El seed (`prisma/seed.ts`, runner `tsx`) es idempotente (upserts por `slug`/`sku`) y se autoverifica (falla si no se cumplen los mínimos del catálogo).
- **Entorno en runtime del seed**: `@prisma/client` no carga `.env` de forma fiable con el cliente generado vía pnpm; el seed lo carga explícitamente (`process.loadEnvFile`). No depender del auto-load de `.env` en scripts.
- **Acceso a datos**: Prisma solo desde `src/lib/db` (singleton `globalThis`); ninguna página/componente en `src/` instancia `PrismaClient`. Las consultas de catálogo viven en `src/lib/catalog.ts` y reciben el cliente por parámetro (inyectable) para poder testear contra una base temporal.
- **Render del catálogo**: `src/app/page.tsx` es un Server Component `async` con `export const dynamic = "force-dynamic"`, de modo que lee la base en cada request en vez de congelar el catálogo en `next build`.
- **Estilos**: CSS Modules (`*.module.css`) por componente + `src/app/globals.css` (importado en `layout.tsx`) con los tokens de `DESIGN.md` como variables CSS. Sin Tailwind ni librerías de estilos (el scaffold fue `--no-tailwind`).
- **Presentación de dinero**: en UI siempre vía `formatPrice` (`Intl.NumberFormat` es-ES); nunca se concatenan centavos a mano.
- **Testing**: Vitest + Testing Library + jsdom; los tests de datos (`prisma/seed.test.ts`, `src/lib/catalog.test.ts`) corren en entorno `node` sobre bases temporales. `vitest.config.ts` replica el alias `@/* → ./src/*` de tsconfig (Vitest no lee `paths`) y los tests que renderizan varias veces llaman a `cleanup` explícito (Vitest sin `globals: true` no activa la limpieza automática de Testing Library). El gate de verificación es install + db:setup + lint + typecheck + test + build, ejecutable desde `./init.sh`.
- **E2E**: diferido al primer flujo mutante (`cart-add` o `product-detail`). `catalog-list` no introduce Playwright/Cypress: el catálogo es de solo lectura, sin navegación mutante ni API, y su contrato clave es visual/responsive (cubierto por la verificación con Chrome DevTools MCP del validator) más la cobertura de Vitest. Corrige la nota previa "E2E a partir de `catalog-list`".
- **Lint**: ESLint 9 (flat config) con `eslint-config-next`.
- **Acceso a IA**: proveedor/modelo solo desde env (`DEVEXPERT_API_KEY` + `AI_*`), con los defaults centralizados en `src/lib/ai/config.ts` (y documentados en `.env.example`); el SDK `openai` solo se instancia en `src/lib/ai/client.ts` (misma disciplina de "puerta única" que `db.ts`). Sin clave, `getAiStatus`/`chatCompletion`/`imageEdit` devuelven un `AiResult` controlado (`ai_disabled` + `AI_MESSAGES.disabled`) sin red ni excepción; los fallos del proveedor se normalizan (429 → `ai_quota`). `getAiStatus` es una sonda: `configured` significa "hay clave", no "clave válida" (no se valida contra el gateway ni se gasta cupo). El wrapper `imageEdit` fija el contrato de entrada/salida para `tryon-result` (sin decidir aún SDK `images.edit` vs `fetch` multipart).

## Constraints

Ver `CONSTRAINTS.md` para reglas MUST/MUST NOT durables.
