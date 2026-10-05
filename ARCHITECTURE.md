# Architecture

## Runtime Surface

Monolito simple sobre **Next.js (App Router)** en TypeScript. Una única app sirve tanto el frontend (React Server Components / páginas) como el backend (API routes / server actions) sin procesos separados.

- **Framework**: Next.js 15 (App Router, `src/app`).
- **Lenguaje**: TypeScript (estricto).
- **Gestor de paquetes**: pnpm (lockfile commiteado).
- **Persistencia**: SQLite vía **Prisma** (sin servicio externo; un único archivo de base de datos local).

## Layers

1. **UI / páginas** — `src/app/*`: rutas, layouts y componentes React. Home mínima de arranque en `src/app/page.tsx`.
2. **Lógica de dominio / servicios** — se añadirá en features posteriores (`catalog-list` en adelante).
3. **Persistencia** — Prisma (`prisma/schema.prisma`) sobre SQLite. Modelo completo definido (10 tablas): `Category`, `Product`, `Variant`, `User`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat` y `TryonImage`. Las migraciones viven commiteadas en `prisma/migrations/` (`<timestamp>_init_catalog`). El catálogo de ejemplo se carga con un seed idempotente (`prisma/seed.ts`, `pnpm db:seed`) que hace upserts por `slug`/`sku`. `prisma generate` se ejecuta en `postinstall`, de modo que `pnpm install` deja el cliente tipado. Convenciones: dinero en **centavos** (`priceCents`, `unitPriceCents`, `totalCents`); estados como `String` con valores documentados (SQLite no soporta enums); sin campos `Json` ni blobs (historial de chat como `String` serializado, imágenes solo como referencias).
4. **Configuración de entorno** — `.env` (local, no commiteado; `./init.sh` lo crea desde `.env.example` si falta) y `.env.example` (commiteado). Claves de IA vía variables de entorno.

## Dependency Direction

`src/app` → (futuro) dominio/servicios → Prisma (`@prisma/client`) → SQLite.

No hay dependencia inversa ni servicios externos obligatorios para arrancar.

## Decisions

- **ORM**: Prisma (v6) con SQLite, decisión tomada en `bootstrap-stack`. `DATABASE_URL="file:./dev.db"` (relativa a `prisma/`). Alternativa evaluada: Drizzle; descartada por familiaridad y tooling de migraciones integrado de Prisma.
- **Migraciones y seed**: migraciones SQL commiteadas en `prisma/migrations/` (generadas con `prisma migrate dev`); `pnpm db:setup` = `prisma migrate deploy` + `pnpm db:seed`. El seed (`prisma/seed.ts`, runner `tsx`) es idempotente (upserts por `slug`/`sku`) y se autoverifica (falla si no se cumplen los mínimos del catálogo).
- **Entorno en runtime del seed**: `@prisma/client` no carga `.env` de forma fiable con el cliente generado vía pnpm; el seed lo carga explícitamente (`process.loadEnvFile`). No depender del auto-load de `.env` en scripts.
- **Testing**: Vitest + Testing Library + jsdom; el test del seed corre en entorno `node` sobre una base temporal. El gate de verificación es install + db:setup + lint + typecheck + test + build, ejecutable desde `./init.sh`.
- **Lint**: ESLint 9 (flat config) con `eslint-config-next`.

## Constraints

Ver `CONSTRAINTS.md` para reglas MUST/MUST NOT durables.
