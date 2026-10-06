# Constraints

Reglas durables que las features futuras deben respetar.

## MUST

- **Usar `pnpm`** como gestor de paquetes y commitear `pnpm-lock.yaml`. Razón: reproducibilidad del arranque (`./init.sh` usa `--frozen-lockfile` cuando el lockfile existe).
- **Ejecutar en local con un único comando** (`pnpm dev`) sin servicios externos obligatorios. Razón: criterio de éxito del producto.
- **Persistencia SQLite local** (archivo) vía Prisma; sin base de datos remota ni servicio de persistencia externo en el MVP. Razón: cero configuración externa.
- **Commitear las migraciones** de Prisma (`prisma/migrations/`). Razón: un checkout fresco debe reconstruir el esquema con `prisma migrate deploy` sin pasos manuales.
- **Mantener el seed idempotente** (`prisma/seed.ts`): upserts por claves estables (`Category.slug`, `Product.slug`, `Variant.sku`); re-ejecutar no duplica datos. Razón: `./init.sh` y `pnpm db:seed` pueden correr N veces.
- **Dinero siempre en centavos (`Int`)** en el modelo (`priceCents`, `unitPriceCents`, `totalCents`). Razón: evitar errores de coma flotante.
- **Guardar estados como `String` con valores documentados** (SQLite no soporta enums) y **nunca blobs ni campos `Json`**: historial de chat como `String` serializado e imágenes solo como referencias (`String`). Razón: portabilidad y base de datos ligera.
- **El seed debe cargar `.env` explícitamente en runtime** (p. ej. `process.loadEnvFile`). Razón: `@prisma/client` no resuelve `.env` de forma fiable cuando el cliente se genera antes de existir `.env` (caso del checkout limpio).
- **`./init.sh` no debe arrancar dev servers** ni procesos de larga vida; solo ejecuta el gate de verificación (install + db:setup + lint + typecheck + test + build) de forma no bloqueante. Razón: dejar el repo limpio para la siguiente sesión.
- **Mantener el gate de calidad** (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`) y la preparación de datos (`pnpm db:setup`) ejecutándose desde `./init.sh`. Razón: verificación reproducible de la base.
- **Acceder a Prisma solo desde `src/lib/db`** (singleton `globalThis`); las consultas de datos viven en `src/lib/*` y las páginas/componentes de `src/` no instancian `PrismaClient` ni importan `@prisma/client` directamente. El CLI del seed (`prisma/seed.ts`) queda fuera de `src/` y usa su propio cliente. Razón: una única puerta a la base, testeable por inyección y sin fugas de conexiones.
- **Formatear el dinero en UI siempre con `formatPrice`** (`src/lib/format.ts`), a partir de centavos; nunca concatenar `priceCents`/`totalCents` a mano ni dividir por 100 en la vista. Razón: formato `es-ES` consistente (p. ej. "19,99 €") y una sola política de presentación monetaria.
- **Estilar con CSS Modules (`*.module.css`) y los tokens de `DESIGN.md`** expuestos en `src/app/globals.css`. Prohibido añadir Tailwind u otra librería de estilos, o colores/espaciados hardcodeados fuera de los tokens. Razón: convención única de estilos y fidelidad a la dirección visual.

## MUST NOT

- **No commitear claves/secrets** (p. ej. `DEVEXPERT_API_KEY`) ni el archivo `.env`. Las claves van en `.env` (ignorado) y se documentan en `.env.example` (commiteado). Razón: seguridad y formación AI Expert (clave personal).
- **No cambiar el esquema sin migración commiteada** ni editar la base a mano. Razón: el esquema es reproducible desde `prisma/migrations/`.
- **No añadir despliegue cloud ni CI remoto** en el MVP; solo scripts locales. Razón: non-goal del slice.
