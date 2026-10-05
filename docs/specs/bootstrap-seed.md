# Feature Implementation Spec: Modelo de datos y seed del catálogo

## Source Feature

- `id`: `bootstrap-seed`
- `area`: `bootstrap`
- `depends_on`: `["bootstrap-stack"]` (satisfecho; `bootstrap-stack` en `accepted`)
- `status`: `not_started`
- `source`: `feature_list.json`

## Goal

Definir el modelo de datos completo de la tienda en Prisma (tablas `User`, `Product`, `Variant`, `Category`, `Cart`/`CartItem`, `Order`, `OrderLine`, `Chat`, `TryonImage`), crear sus migraciones SQLite y cargar un seed idempotente de catálogo de ejemplo (categorías, productos, variantes con talla/color/stock/precio) suficiente para demostrar catálogo, filtros y una compra. La ruta estándar de arranque (`./init.sh`) debe dejar la base poblada en `prisma/dev.db`, verificado por un test automatizado. Resultado: las features posteriores (catálogo, filtros, carrito, checkout) trabajan sobre datos reales desde el primer momento.

## Non-Goals

- No crear UI de catálogo, páginas ni componentes (`catalog-list` en adelante).
- No crear API routes, server actions ni capa de acceso a datos en runtime (`src/lib/db` la introduce `catalog-list`).
- No implementar auth, sesiones ni hashing de contraseñas: solo el campo `passwordHash` en el modelo `User` (la creación de usuarios es `checkout-user`).
- No seedear usuarios, pedidos, carritos, chats ni try-ons: esas tablas quedan vacías (la compra se materializa en features de checkout).
- No integrar IA ni subir fotos reales: `TryonImage` es solo el modelo con referencias (`ai-provider-config`, `tryon-*`).
- No decidir la identidad del invitado ni la persistencia runtime del carrito (`cart-add`); el modelo solo debe soportar ambos casos.
- No panel de administración, datos reales de producto ni despliegue/CI remoto.

## Job Story

When quiero construir catálogo, filtros, carrito y checkout sobre una base real sin perder tiempo preparando datos,
I want un modelo de datos completo y un seed idempotente de catálogo de ejemplo cargado por la ruta estándar de arranque,
so I can demostrar catálogo, filtros y una compra de extremo a extremo sin panel de administración ni datos reales.

## Users And Permissions

- **Desarrollador/agente**: único actor. Ejecuta `./init.sh` (instala, migra, siembra y verifica) y `pnpm dev` para trabajar. No hay UI ni control de acceso en este feature.
- **Usuario/Invitado (modelado, no funcional)**: las tablas `User`, `Cart`, `Order`, `Chat`, `TryonImage` anticipan sus reglas de dominio (`docs/domain-model.md`), pero ningún comportamiento de acceso se implementa aquí.

## Acceptance Scenarios

### Scenario 1: Las migraciones crean las tablas del dominio

Given `prisma/schema.prisma` con los 10 modelos definidos
When el desarrollador ejecuta las migraciones (`pnpm exec prisma migrate deploy` o `pnpm exec prisma migrate dev`)
Then existen y son consultables las tablas `User`, `Product`, `Variant`, `Category`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat`, `TryonImage`.

### Scenario 2: El seed puebla un catálogo demostrable

Given una base recién migrada sin datos
When el desarrollador ejecuta `pnpm db:seed`
Then hay 3 categorías, 8 productos y 24–30 variantes con talla, color, stock y precio; el catálogo cubre 4 tallas (S/M/L/XL), al menos 4 colores y precios de 19,99 € a 119,99 € (filtros demostrables); incluye al menos 2 variantes agotadas (stock 0) y al menos 2 productos con todas sus variantes con stock > 0 (compra demostrable); cada producto referencia un placeholder de imagen local bajo `/images/products/`.

### Scenario 3: El seed es idempotente

Given una base ya sembrada
When el desarrollador ejecuta `pnpm db:seed` una segunda vez
Then los conteos de categorías/productos/variantes no cambian y no se crean duplicados (upserts por `slug`/`sku`).

### Scenario 4: Un test verifica el catálogo poblado

Given el repo con el modelo, las migraciones y el seed
When el desarrollador ejecuta `pnpm test`
Then el test de seed aplica migraciones y seed sobre una base temporal y verifica que el catálogo quedó poblado (conteos, dimensiones de filtro, estados de stock) e idempotente; `pnpm test` termina en verde (exit 0).

### Scenario 5: La ruta estándar de arranque deja la base poblada

Given un checkout limpio (sin `prisma/dev.db`)
When el desarrollador ejecuta `./init.sh`
Then el script asegura `.env` (lo copia de `.env.example` si falta), ejecuta `pnpm db:setup` (migraciones + seed) y el gate completo (install + db:setup + lint + typecheck + test + build), sale con código 0, deja `prisma/dev.db` con el catálogo poblado y no arranca ningún dev server.

## Repository Research

### Files Inspected

- `feature_list.json` — alcance y verificación de `bootstrap-seed`; dependencia `bootstrap-stack` en `accepted`.
- `PROGRESS.md` — pendiente declarado: `@prisma/client` sin `prisma generate` (se resuelve aquí); última verificación `./init.sh` en verde.
- `prisma/schema.prisma` — solo `generator client` + `datasource db` (SQLite, `env("DATABASE_URL")`); **sin modelos**.
- `package.json` — scripts `dev/build/start/lint/typecheck/test`; `@prisma/client` y `prisma` ^6 (instaladas 6.19.3); **sin `tsx`/`ts-node`**; build scripts de `@prisma/client` ignorados a propósito vía `pnpm.onlyBuiltDependencies`.
- `init.sh` — gate real (`set -euo pipefail`): install → lint → typecheck → test → build; **no prepara la base de datos** ni crea `.env`.
- `.env.example` — `DATABASE_URL="file:./dev.db"` (ruta relativa a `prisma/`) y hueco `DEVEXPERT_API_KEY`. En este worktree **no existe `.env`** (no commiteado): un checkout fresco no tiene `DATABASE_URL` listo.
- `.gitignore` — ya ignora `prisma/dev.db`, `*.db`, `*.db-journal` (las bases temporales quedan cubiertas).
- `docs/domain-model.md` — entidades, relaciones y estados a materializar en el esquema.
- `docs/technical-discovery.md` — listado de tablas (`User`, `Product`, `Variant`, `Category`, `Cart`/`CartItem`, `Order`, `OrderLine`, `Chat`, `TryonImage`); "ejecutar en local con un comando"; imágenes try-on como referencia (URL/upload temporal), a decidir en implementación.
- `CONTEXT.md`, `docs/build-brief.md`, `docs/risks-and-open-questions.md` — glosario, non-goals y preguntas abiertas (nº de variantes por producto para el seed; persistencia del carrito; almacenamiento de imágenes try-on).
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — capas y reglas durables de `bootstrap-stack` (el MUST NOT "no definir modelo/migraciones/seed en esta fase" caduca con esta feature).
- `docs/specs/bootstrap-stack.md` — estructura y estilo de spec a seguir.
- `tsconfig.json` — `include: ["**/*.ts", ...]`: `prisma/seed.ts` y su test quedarán bajo `pnpm typecheck`.
- `vitest.config.ts`, `src/app/page.test.tsx` — Vitest + Testing Library + jsdom; tests colocados junto al código fuente.
- `AGENTS.md` — la ruta estándar es `./init.sh`; el gate documentado debe mantenerse sincronizado si cambia.

Nota: `DESIGN.md` existe pero no se inspeccionó en detalle (este slice no toca UI). No existen `docs/mvp-scope.md`, `docs/product-brief.md`, `docs/user-and-access-model.md` ni `docs/adr/*`.

### Existing Patterns To Follow

- ORM decidido en `bootstrap-stack`: **Prisma 6 + SQLite** con `DATABASE_URL="file:./dev.db"`. Modelos y migraciones son precisamente el alcance delegado a esta feature.
- Gate de verificación desde `./init.sh`: no bloqueante, sin dev servers; cualquier paso nuevo se documenta (precedente: reescritura de `init.sh` en `bootstrap-stack`).
- TypeScript estricto; tests Vitest colocados (`*.test.ts` junto al código); docs y comentarios en español.

### Current Gaps

- `prisma/schema.prisma` sin modelos; sin `prisma/migrations/`; `@prisma/client` sin generar.
- Sin script de seed ni runner TS (`tsx`) para ejecutarlo.
- `init.sh` no migra ni siembra; un checkout fresco carece de `.env`.
- Sin capa de acceso a datos en runtime ni harness E2E (asentado en `bootstrap-stack`; E2E a partir de `catalog-list`).

## Technical Approach

1. **Modelo Prisma (10 modelos)** en `prisma/schema.prisma`, alineado con `docs/domain-model.md` y el listado de tablas de `docs/technical-discovery.md`. Convenciones: IDs `cuid()`, `createdAt`/`updatedAt`, dinero en **centavos (`Int`)**: `priceCents`, `unitPriceCents`, `totalCents`; estados como `String` con valores documentados en comentarios (SQLite no soporta enums de Prisma); **sin campos `Json`** (historial del chat como `String` de JSON serializado) y sin blobs (imágenes solo como `String` de referencia).
   - `Category(id, slug @unique, name)` 1‑n `Product`.
   - `Product(id, slug @unique, name, description, imageUrl, priceCents, currency @default("EUR"), categoryId FK, createdAt)` 1‑n `Variant`.
   - `Variant(id, productId FK onDelete: Cascade, size, color, sku @unique, stock Int @default(0), priceCents)`; `@@unique([productId, size, color])`. `Agotada` es derivado (stock = 0), sin campo de estado.
   - `User(id, email @unique, passwordHash, name, addressLine?, city?, postalCode?, phone?, createdAt)` — datos de contacto/envío en `User` según `docs/domain-model.md`.
   - `Cart(id, userId? FK, guestId?, createdAt, updatedAt)` 1‑n `CartItem(id, cartId FK onDelete: Cascade, variantId FK, quantity)` con `@@unique([cartId, variantId])`. Soporta usuario (`userId`) e invitado (`guestId`); cómo se identifica al invitado lo decide `cart-add`.
   - `Order(id, userId FK, status String /* "PENDIENTE_PAGO" | "PAGADO" | "CANCELADO" */, paymentStatus String /* "PENDIENTE" | "APROBADO" | "RECHAZADO" */, totalCents, createdAt)` 1‑n `OrderLine(id, orderId FK onDelete: Cascade, variantId FK, quantity, unitPriceCents)`. El pago simulado se modela como `paymentStatus` en `Order` (sin tabla `Payment`), coherente con "determina el estado del pedido".
   - `Chat(id, userId? FK, guestId?, messages String /* JSON serializado del historial */, createdAt, updatedAt)`.
   - `TryonImage(id, userId? FK, guestId?, productId FK, variantId? FK, status String /* "SOLICITADO" | "GENERADO" | "ERROR" */, sourceRef, resultRef?, error?, createdAt, updatedAt)` — solo referencias a ficheros/URLs (decisión sobre "URL o upload temporal"), nunca blobs en la base.
   - Nota: `Order` es palabra reservada SQL; Prisma cita identificadores al migrar (sin acción adicional).
2. **Migración**: `pnpm exec prisma migrate dev --name init_catalog` genera `prisma/migrations/` (con `migration_lock.toml`), que se **commitea**. `prisma generate` se ejecuta vía script `postinstall` (era el pendiente declarado en `PROGRESS.md`), de modo que `pnpm install` deja el cliente tipado para `typecheck` y los tests.
3. **Seed idempotente** `prisma/seed.ts`: exporta `seedCatalog(client)` y es ejecutable CLI (`tsx prisma/seed.ts`). Upserts por claves estables (`Category.slug`, `Product.slug`, `Variant.sku`); re-ejecutar no duplica. Diseño de datos (resuelve la pregunta abierta "¿cuántas variantes/tallas/colores por producto?" en `docs/risks-and-open-questions.md`):
   - 3 categorías: `camisetas`, `pantalones`, `abrigos`.
   - 8 productos (3/3/2 por categoría) con nombre y descripción en español; slugs `camiseta-basica`, `camiseta-estampada`, `camiseta-manga-larga`, `pantalon-chino`, `pantalon-vaquero`, `pantalon-deportivo`, `abrigo-ligero`, `abrigo-invierno`; precios 19,99 €–119,99 € en centavos (variedad suficiente para el filtro de precio).
   - 24–30 variantes (3–4 por producto) combinando tallas S/M/L/XL y colores negro/blanco/azul/rojo, sin repetir `[talla, color]` por producto; `sku = "<slug>-<TALLA>-<color>"` (ej. `camiseta-basica-S-negro`); `priceCents` = precio del producto.
   - Stock 1–15 en general; **al menos 2 variantes con stock 0** (estado `Agotada` visible en detalle) y **al menos 2 productos con todas sus variantes en stock** (compra realizable de extremo a extremo).
   - `createdAt` escalonado (aprox. 1 producto por semana hacia atrás) para que "novedad" sea demostrable en ordenaciones.
   - `imageUrl = "/images/products/<slug>.svg"` con 8 SVGs placeholder planos (color de fondo + nombre) committeados en `public/images/products/` — funciona sin red.
   - Al terminar imprime resumen de conteos y **falla (exit != 0)** si no se cumplen los mínimos (autoverificación del script).
   - No siembra `User`, `Cart`, `CartItem`, `Order`, `OrderLine`, `Chat`, `TryonImage` (tablas vacías).
4. **Test de verificación** `prisma/seed.test.ts` (Vitest, entorno `node`): usa una base temporal (`file:./test-seed.db` bajo `prisma/`, ya cubierta por `.gitignore`), aplica las migraciones con `pnpm exec prisma migrate deploy` sobrescribiendo `DATABASE_URL` (env del proceso y del `execSync`), ejecuta `seedCatalog` y verifica: (a) los 10 modelos son consultables (prueba de que las tablas existen); (b) conteos mínimos y dimensiones de filtro (3 categorías, 8 productos, 24–30 variantes, 4 tallas, al menos 4 colores, precio mín/máx distinguibles); (c) al menos 2 variantes agotadas y al menos 2 productos con todas sus variantes en stock; (d) idempotencia (segunda ejecución = mismos conteos). Limpia la base temporal al finalizar.
5. **Scripts y arranque**: `package.json` añade `postinstall` (`prisma generate`), `db:seed` (`tsx prisma/seed.ts`) y `db:setup` (`prisma migrate deploy && pnpm db:seed`); devDep `tsx` (runner del seed en TS). `init.sh` gana dos pasos tras install: asegurar `.env` (copiar de `.env.example` si no existe) y `pnpm db:setup`. El script sigue **sin arrancar dev servers**: solo ejecuta checks y preparación de datos determinista.

## Expected File Changes

- `prisma/schema.prisma` — modify; 10 modelos con relaciones, índices y comentarios de estados.
- `prisma/migrations/migration_lock.toml` + `prisma/migrations/<timestamp>_init_catalog/migration.sql` — create (vía `pnpm exec prisma migrate dev --name init_catalog`); commiteadas.
- `prisma/seed.ts` — create; `seedCatalog` idempotente + CLI con resumen y autoverificación.
- `prisma/seed.test.ts` — create; test de integración sobre base temporal.
- `public/images/products/*.svg` (8) — create; placeholders locales por producto.
- `package.json` — modify; scripts `postinstall`, `db:seed`, `db:setup`; devDep `tsx`.
- `init.sh` — modify; pasos de `.env` y `pnpm db:setup` (sigue sin dev servers).
- `ARCHITECTURE.md` — update; `CONSTRAINTS.md` — update; `AGENTS.md` — update (ver Durable Documentation Impact).
- `docs/risks-and-open-questions.md` — update; `feature_list.json`, `PROGRESS.md` — update (evidencia de fin de sesión).
- `.gitignore` — not needed (ya cubre `*.db` / `*.db-journal`); solo verificar.

## Visual Design Impact

- UI involved: no (solo datos; los SVG son assets planos, sin dirección visual de producto).
- Design source: not applicable — `DESIGN.md` no se aplica en este slice.
- Screens or states affected: ninguno.
- New design artifact required: no.

## Durable Documentation Impact

- `ARCHITECTURE.md`: **update** — la capa de persistencia deja de estar "sin modelos": documentar los 10 modelos, migraciones commiteadas, seed idempotente, `prisma generate` vía `postinstall` y dinero en centavos.
- `CONSTRAINTS.md`: **update** — el MUST NOT "no definir el modelo de dominio, migraciones ni seed en esta fase" caduca; sustituirlo por reglas durables: migraciones commiteadas y seed idempotente (sin duplicados), dinero en centavos, imágenes como referencias (sin blobs), estados como strings documentados. Mantener el MUST del gate y reflejar que `init.sh` ahora incluye `db:setup` además de install + lint + typecheck + test + build.
- `AGENTS.md`: **update** — la ruta estándar de arranque/verificación cambia (`./init.sh` incluye `pnpm db:setup`); sincronizar la sección "Stack y verificación estándar".
- `docs/risks-and-open-questions.md`: **update** — resolver "¿Cuántas variantes/tallas/colores por producto requiere el seed?" (decidido aquí) y anotar que las imágenes try-on se almacenan como referencias (decisión parcial de "URL vs upload temporal").
- `docs/domain-model.md`, `docs/technical-discovery.md`: **not needed** — el esquema los sigue sin contradecir (el pago simulado vive en `paymentStatus` de `Order`, coherente con el dominio).
- `PROGRESS.md`, `feature_list.json`: **update** — evidencia de verificación al cerrar la sesión.

## Implementation Plan

1. Asegurar `.env` (copiar de `.env.example`) y definir los 10 modelos en `prisma/schema.prisma` según el Technical Approach.
2. Validar (`pnpm exec prisma validate`) y crear la migración inicial (`pnpm exec prisma migrate dev --name init_catalog`); generar el cliente (`pnpm exec prisma generate`).
3. Crear los 8 SVGs placeholder en `public/images/products/`.
4. Implementar `prisma/seed.ts` (datos del diseño, upserts por slug/sku, resumen + autoverificación).
5. Añadir a `package.json` los scripts (`postinstall`, `db:seed`, `db:setup`) y la devDep `tsx`.
6. Extender `init.sh`: asegurar `.env` y ejecutar `pnpm db:setup` (sin dev servers).
7. Escribir `prisma/seed.test.ts` (base temporal; asserts de tablas, conteos, dimensiones e idempotencia).
8. Ejecutar `./init.sh` completo y confirmar que `prisma/dev.db` queda poblado; capturar evidencia.
9. Actualizar docs durables (`ARCHITECTURE.md`, `CONSTRAINTS.md`, `AGENTS.md`, `docs/risks-and-open-questions.md`) y cerrar con `feature_list.json` + `PROGRESS.md`.

## Implementation Tasks

- [ ] Definir los 10 modelos (Category, Product, Variant, User, Cart, CartItem, Order, OrderLine, Chat, TryonImage) en `prisma/schema.prisma`.
- [ ] `pnpm exec prisma validate` en verde y migración `init_catalog` creada y commiteada (`prisma/migrations/`).
- [ ] Confirmar que `prisma generate` produce el cliente tipado (script `postinstall`).
- [ ] Crear 8 SVGs placeholder en `public/images/products/` referenciados por el seed.
- [ ] Implementar `prisma/seed.ts` (seed idempotente con el diseño de datos del spec + resumen y exit code).
- [ ] Añadir scripts `postinstall`/`db:seed`/`db:setup` y devDep `tsx` en `package.json`.
- [ ] Extender `init.sh` con `.env` (copy de `.env.example` si falta) y `pnpm db:setup`.
- [ ] Implementar `prisma/seed.test.ts` (tablas consultables, conteos, dimensiones de filtro, stock, idempotencia).
- [ ] Ejecutar `./init.sh` completo en verde y verificar `prisma/dev.db` poblado (resumen del seed).
- [ ] Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md`, `AGENTS.md`, `docs/risks-and-open-questions.md`, `feature_list.json`, `PROGRESS.md`.

## Verification Plan

- `pnpm install` → OK; `postinstall` ejecuta `prisma generate` sin errores (cliente tipado disponible).
- `pnpm exec prisma validate` → exit 0.
- `pnpm db:setup` (`prisma migrate deploy` + `pnpm db:seed`) → crea las 10 tablas (evidencia: `migration.sql` con `CREATE TABLE "User"` etc. y modelos consultables) e imprime el resumen de conteos.
- `pnpm db:seed` → imprime resumen (3 categorías, 8 productos, 24–30 variantes, al menos 2 agotadas) y sale 0; segunda ejecución idéntica (sin duplicados).
- `pnpm test` → incluye `prisma/seed.test.ts` (base temporal) en verde, exit 0.
- `pnpm lint`, `pnpm typecheck`, `pnpm build` → exit 0 (el seed y su test quedan bajo `tsc --noEmit`).
- `./init.sh` → asegura `.env` si falta, ejecuta install + `pnpm db:setup` + lint + typecheck + test + build, exit 0, sin dejar procesos dev; `prisma/dev.db` queda poblado (catálogo disponible tras el arranque estándar).
- E2E: no hay harness E2E persistente (asentado en `bootstrap-stack`; se introduce con `catalog-list`). Este feature no añade UI, routing ni flujos de API observables: la cobertura del test de integración de Vitest es suficiente y procedente.
- `init.sh`: gate **no bloqueante** que ejecuta checks y preparación de datos determinista (migraciones + seed); **no** arranca servicios de larga vida (`pnpm dev`); puede imprimir comandos manuales al final.

## Evidence To Capture

- Salida de `pnpm exec prisma migrate dev --name init_catalog` (nombre de la migración generada) y extracto de `migration.sql` con las 10 tablas.
- Resumen de conteos impreso por `pnpm db:seed` (categorías/productos/variantes/agotadas) y confirmación de idempotencia (conteos tras una segunda ejecución).
- Nombres de los tests de `prisma/seed.test.ts` y salida de `pnpm test`.
- Salida de `./init.sh` (exit 0; pasos install + db:setup + lint + typecheck + test + build).
- Versiones finales de `prisma`/`@prisma/client`/`tsx` en `package.json`.
- Registrar todo en `feature_list.json` (campo `evidence`) y `PROGRESS.md`.

## Validator Checklist

- [ ] La implementación se mantiene dentro del alcance de `bootstrap-seed` (solo modelo, migraciones, seed y su verificación; sin UI, endpoints, auth ni lógica de negocio).
- [ ] Los 5 escenarios de aceptación pasan (tablas creadas; seed suficiente para catálogo/filtros/una compra; idempotencia; test verde; `./init.sh` deja la base poblada sin dev servers).
- [ ] El seed cumple el diseño de datos: 3 categorías, 8 productos, 24–30 variantes, 4 tallas, al menos 4 colores, precios 19,99–119,99 €, al menos 2 variantes agotadas, al menos 2 productos comprables, `createdAt` escalonado, imágenes placeholder locales.
- [ ] Migraciones commiteadas; dinero en centavos; estados como strings documentados; sin blobs ni campos `Json`.
- [ ] La verificación de "catálogo poblado tras el arranque" existe como test automatizado y su evidencia está registrada.
- [ ] `init.sh` sigue sin arrancar dev servers y el cambio de gate quedó documentado en `AGENTS.md`/`CONSTRAINTS.md`.
- [ ] `feature_list.json` y `PROGRESS.md` fueron actualizados correctamente.
- [ ] No se añadió trabajo de features posteriores ni comportamiento no solicitado.