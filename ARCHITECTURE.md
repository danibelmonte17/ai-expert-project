# Architecture

## Runtime Surface

Monolito simple sobre **Next.js (App Router)** en TypeScript. Una única app sirve tanto el frontend (React Server Components / páginas) como el backend (API routes / server actions) sin procesos separados.

- **Framework**: Next.js 15 (App Router, `src/app`).
- **Lenguaje**: TypeScript (estricto).
- **Gestor de paquetes**: pnpm (lockfile commiteado).
- **Persistencia**: SQLite vía **Prisma** (sin servicio externo; un único archivo de base de datos local).

## Layers

1. **UI / páginas** — `src/app/*` (rutas y layouts) y `src/components/*` (componentes presentacionales, puros y sin Prisma). El listado de catálogo vive en `src/app/page.tsx` (RSC async + `force-dynamic`), que delega en `ProductGrid`/`ProductCard` (cada card es un `Link` a la ficha). El detalle vive en `src/app/productos/[slug]/page.tsx` (RSC async + `force-dynamic` + `notFound()` + `generateMetadata`), que resuelve el producto por slug y delega en `ProductDetail`/`VariantSelector`. `ProductDetail` es el primer componente `"use client"` del repo: mantiene la selección talla/color como estado local; el RSC consulta y le pasa el DTO. La frontera de cliente no toca Prisma.
2. **Acceso a datos y presentación** — `src/lib/*` (introducida por `catalog-list`): `db.ts` es el único punto que instancia `PrismaClient` (singleton en `globalThis` para sobrevivir al HMR en dev); `catalog.ts` expone las consultas de catálogo (`listCatalogProducts`, orden `createdAt` desc; `getProductDetailBySlug`, con categoría y variantes, ambas con cliente inyectable); `variants.ts` (product-detail) concentra la lógica pura de la matriz sparse (`variantState`, `resolveVariant`, `sizesIn`/`colorsIn`, `isSelectable`, `isSoldOutOption`, `nextSelection`), sin Prisma; `format.ts` centraliza la presentación de dinero (`formatPrice`). Las páginas no usan Prisma directamente.
3. **Persistencia** — Prisma (`prisma/schema.prisma`) sobre SQLite. Modelo completo definido (10 tablas): `Category`, `Product`, `Variant`, `User`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat` y `TryonImage`. Las migraciones viven commiteadas en `prisma/migrations/` (`<timestamp>_init_catalog`). El catálogo de ejemplo se carga con un seed idempotente (`prisma/seed.ts`, `pnpm db:seed`) que hace upserts por `slug`/`sku`. `prisma generate` se ejecuta en `postinstall`, de modo que `pnpm install` deja el cliente tipado. Convenciones: dinero en **centavos** (`priceCents`, `unitPriceCents`, `totalCents`); estados como `String` con valores documentados (SQLite no soporta enums); sin campos `Json` ni blobs (historial de chat como `String` serializado, imágenes solo como referencias).
4. **Configuración de entorno** — `.env` (local, no commiteado; `./init.sh` lo crea desde `.env.example` si falta) y `.env.example` (commiteado). Claves de IA vía variables de entorno.

## Dependency Direction

`src/app` → `src/components` + `src/lib` (`catalog.ts` → `db.ts`; `variants.ts` es puro) → Prisma (`@prisma/client`) → SQLite.

No hay dependencia inversa ni servicios externos obligatorios para arrancar.

## Decisions

- **ORM**: Prisma (v6) con SQLite, decisión tomada en `bootstrap-stack`. `DATABASE_URL="file:./dev.db"` (relativa a `prisma/`). Alternativa evaluada: Drizzle; descartada por familiaridad y tooling de migraciones integrado de Prisma.
- **Migraciones y seed**: migraciones SQL commiteadas en `prisma/migrations/` (generadas con `prisma migrate dev`); `pnpm db:setup` = `prisma migrate deploy` + `pnpm db:seed`. El seed (`prisma/seed.ts`, runner `tsx`) es idempotente (upserts por `slug`/`sku`) y se autoverifica (falla si no se cumplen los mínimos del catálogo).
- **Entorno en runtime del seed**: `@prisma/client` no carga `.env` de forma fiable con el cliente generado vía pnpm; el seed lo carga explícitamente (`process.loadEnvFile`). No depender del auto-load de `.env` en scripts.
- **Acceso a datos**: Prisma solo desde `src/lib/db` (singleton `globalThis`); ninguna página/componente en `src/` instancia `PrismaClient`. Las consultas de catálogo viven en `src/lib/catalog.ts` y reciben el cliente por parámetro (inyectable) para poder testear contra una base temporal.
- **Render del catálogo**: `src/app/page.tsx` es un Server Component `async` con `export const dynamic = "force-dynamic"`, de modo que lee la base en cada request en vez de congelar el catálogo en `next build`.
- **Render del detalle** (product-detail): `src/app/productos/[slug]/page.tsx` es un RSC `async` con `force-dynamic`; en Next 15 `params` es una `Promise` (`await params`), el slug se resuelve con `getProductDetailBySlug` y un slug desconocido dispara `notFound()`. `generateMetadata` usa el nombre del producto como `title`. Es dinámico por la misma razón que el catálogo (stock/precios se leen por request).
- **Frontera de cliente** (product-detail): `ProductDetail` (y su `VariantSelector`) son los primeros componentes `"use client"`; mantienen la selección talla/color como estado local y derivan la variante, su stock y el `disabled` del CTA. El RSC les pasa el DTO ya resuelto (`CatalogProductDetail`); la UI sigue sin importar `@prisma/client`.
- **Lógica de variantes** (product-detail): vive aislada y pura en `src/lib/variants.ts` para respetar la matriz sparse del seed (no todas las combinaciones talla×color existen): los chips sin combinación quedan `disabled` y nunca se resuelve una variante inexistente.
- **Ancla try-on**: la columna info/compra de la ficha deja un comentario como punto de montaje de `tryon-upload` / `tryon-result` (sin UI todavía).
- **Estilos**: CSS Modules (`*.module.css`) por componente + `src/app/globals.css` (importado en `layout.tsx`) con los tokens de `DESIGN.md` como variables CSS. Sin Tailwind ni librerías de estilos (el scaffold fue `--no-tailwind`).
- **Presentación de dinero**: en UI siempre vía `formatPrice` (`Intl.NumberFormat` es-ES); nunca se concatenan centavos a mano.
- **Testing**: Vitest + Testing Library + jsdom; los tests de datos (`prisma/seed.test.ts`, `src/lib/catalog.test.ts`) corren en entorno `node` sobre bases temporales. `vitest.config.ts` replica el alias `@/* → ./src/*` de tsconfig (Vitest no lee `paths`) y los tests que renderizan varias veces llaman a `cleanup` explícito (Vitest sin `globals: true` no activa la limpieza automática de Testing Library). El gate de verificación es install + db:setup + lint + typecheck + test + build, ejecutable desde `./init.sh`.
- **E2E**: se introduce en `cart-add`, el primer flujo **mutante** (escribe en la base). `catalog-list` y `product-detail` no lo incorporan: el catálogo es de solo lectura y el detalle añade interacción de cliente (selección de variante) pero sin escrituras, sin API y sin navegación mutante, con contrato clave visual/responsive cubierto por la verificación con Chrome DevTools MCP del validator más la cobertura de Vitest. Corrige la nota previa "diferido al primer flujo mutante (`cart-add` o `product-detail`)".
- **Lint**: ESLint 9 (flat config) con `eslint-config-next`.

## Constraints

Ver `CONSTRAINTS.md` para reglas MUST/MUST NOT durables.
