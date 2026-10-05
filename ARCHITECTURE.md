# Architecture

## Runtime Surface

Monolito simple sobre **Next.js (App Router)** en TypeScript. Una única app sirve tanto el frontend (React Server Components / páginas) como el backend (API routes / server actions) sin procesos separados.

- **Framework**: Next.js 15 (App Router, `src/app`).
- **Lenguaje**: TypeScript (estricto).
- **Gestor de paquetes**: pnpm (lockfile commiteado).
- **Persistencia**: SQLite vía **Prisma** (sin servicio externo; un único archivo de base de datos local).

## Layers

1. **UI / páginas** — `src/app/*`: rutas y layouts (App Router). `src/app/page.tsx` es la home y renderiza el listado del catálogo (Server Component `async` con `export const dynamic = "force-dynamic"`; el título de la página es `h1` "Catálogo"). Componentes de presentación reutilizables en `src/components/` (`ProductCard`, `ProductGrid`) con CSS Modules; sin client components en este slice.
2. **Lógica de dominio / acceso a datos** — `src/lib/*`. `db.ts` expone el singleton de `PrismaClient` (guardado en `globalThis` para sobrevivir al HMR de `next dev`). `catalog.ts` contiene consultas de lectura (`getCatalogProducts`, orden por novedad) y el tipo `CatalogProduct` mínimo para la UI (slug, nombre, imagen, precio, moneda, categoría, createdAt). `format.ts` centraliza el formateo de dinero (`formatPriceCents` desde centavos, locale es-ES). Sin mutaciones en esta capa todavía.
3. **Persistencia** — Prisma (`prisma/schema.prisma`) sobre SQLite. Modelo completo definido (10 tablas): `Category`, `Product`, `Variant`, `User`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat` y `TryonImage`. Las migraciones viven commiteadas en `prisma/migrations/` (`<timestamp>_init_catalog`). El catálogo de ejemplo se carga con un seed idempotente (`prisma/seed.ts`, `pnpm db:seed`) que hace upserts por `slug`/`sku`. `prisma generate` se ejecuta en `postinstall`, de modo que `pnpm install` deja el cliente tipado. Convenciones: dinero en **centavos** (`priceCents`, `unitPriceCents`, `totalCents`); estados como `String` con valores documentados (SQLite no soporta enums); sin campos `Json` ni blobs (historial de chat como `String` serializado, imágenes solo como referencias).
4. **Configuración de entorno** — `.env` (local, no commiteado; `./init.sh` lo crea desde `.env.example` si falta) y `.env.example` (commiteado). Claves de IA vía variables de entorno.

## Dependency Direction

`src/app` y `src/components` → `src/lib` (dominio/acceso a datos) → Prisma (`@prisma/client`) → SQLite.

No hay dependencia inversa ni servicios externos obligatorios para arrancar.

## Decisions

- **ORM**: Prisma (v6) con SQLite, decisión tomada en `bootstrap-stack`. `DATABASE_URL="file:./dev.db"` (relativa a `prisma/`). Alternativa evaluada: Drizzle; descartada por familiaridad y tooling de migraciones integrado de Prisma.
- **Migraciones y seed**: migraciones SQL commiteadas en `prisma/migrations/` (generadas con `prisma migrate dev`); `pnpm db:setup` = `prisma migrate deploy` + `pnpm db:seed`. El seed (`prisma/seed.ts`, runner `tsx`) es idempotente (upserts por `slug`/`sku`) y se autoverifica (falla si no se cumplen los mínimos del catálogo).
- **Entorno en runtime del seed**: `@prisma/client` no carga `.env` de forma fiable con el cliente generado vía pnpm; el seed lo carga explícitamente (`process.loadEnvFile`). No depender del auto-load de `.env` en scripts.
- **Testing**: Vitest + Testing Library + jsdom; el test del seed corre en entorno `node` sobre una base temporal. El gate de verificación es install + db:setup + lint + typecheck + test + build, ejecutable desde `./init.sh`.
- **Estilos (UI)**: CSS Modules por componente + custom properties de `DESIGN.md` en `src/app/globals.css` (importado desde `layout.tsx`). Sin Tailwind ni frameworks CSS. Tipografía Inter con fallback de sistema (sin descargar la fuente, la app funciona sin red).
- **Imágenes de producto**: `next/image` con `unoptimized`; los placeholders son SVG locales y el optimizador de Next no procesa SVG por defecto.
- **Lint**: ESLint 9 (flat config) con `eslint-config-next`.

## Constraints

Ver `CONSTRAINTS.md` para reglas MUST/MUST NOT durables.
