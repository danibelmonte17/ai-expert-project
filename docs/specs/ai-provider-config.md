# Feature Implementation Spec: Configuración del proveedor de IA por entorno

## Source Feature

- `id`: `ai-provider-config`
- `area`: `ai`
- `depends_on`: `["bootstrap-stack"]` (satisfecho; `bootstrap-stack` en `accepted`)
- `status`: `not_started`
- `source`: `feature_list.json`

## Goal

Dejar toda la integración de IA gobernada por variables de entorno y con degradación controlada: la ruta de proveedor/modelo (base URL y modelos) se lee de env con defaults documentados (nada de endpoints cableados en la lógica), la clave `DEVEXPERT_API_KEY` es opcional para arrancar, y **sin clave las funciones de IA devuelven un mensaje claro en español en vez de fallar**. Esta feature entrega la capa de acceso a IA (`src/lib/ai/`: config + cliente OpenAI-compatible + contrato de resultado) que consumirán `chatbot-conversation` y `tryon-*`, más una superficie observable mínima (`GET /api/ai/status`) para verificar la degradación end-to-end.

## Non-Goals

- Sin chatbot, widget de chat, prompts con contexto de catálogo ni embeddings/RAG: `chatbot-conversation` / `chatbot-recommend`.
- Sin subida de foto, privacidad, ni generación/muestra de imagen de try-on: `tryon-upload` / `tryon-result`. El wrapper `imageEdit()` aquí es solo transporte + normalización de resultado (sin prompt de prenda, sin persistencia).
- Sin UI nueva (ni pantalla, ni banner, ni estilos): el *copy* de degradación se define como constantes reutilizables; quien lo renderice son las features de chatbot/try-on.
- Sin manejo de cupo semanal más allá de normalizar el error 429 a mensaje controlado (sin reintentos, backoff, colas ni cuotas en cliente).
- Sin validación de la clave contra el gateway en runtime (no se gastará cupo semanal en esta feature) ni llamadas de red en tests.
- Sin harness E2E (Playwright/Cypress) — justificado en Verification Plan.
- Sin tocar `init.sh` ni el gate de verificación; sin cambios de esquema Prisma.

## Job Story

When configuro la tienda para usar IA (y cada estudiante trae su propia clave de DevExpert Inference),
I want que proveedor/modelo/sean configurables por entorno y que la app funcione sin clave degradando con un mensaje claro,
so I can arrancar y verificar el repo sin secrets y activar el chatbot/try-on simplemente añadiendo `DEVEXPERT_API_KEY` a `.env`.

## Users And Permissions

- **Desarrollador/agente (actor principal)**: define `.env` a partir de `.env.example`, puede cambiar base URL/modelos por env y ejecuta el gate. La clave es personal e intransferible y nunca se commitea.
- **Usuario final (indirecto)**: no ve pantallas nuevas en esta feature; recibe el mensaje de degradación cuando las features de IA (chatbot/try-on) lo rendericen.
- **App/funciones de IA**: sin clave degradan con mensaje controlado; nunca rompen la app ni lanzan errores no controlados por ausencia de clave.

## Acceptance Scenarios

### Scenario 1: Defaults documentados sin cablear en la lógica

Given un `.env` sin variables `AI_*` (solo `DATABASE_URL` y `DEVEXPERT_API_KEY` vacía)
When se lee la configuración (`getAiConfig()`)
Then la base URL es `https://inference.devexpert.io/v1` y los modelos son `chat`, `image-edit` y `embedding` (defaults documentados en código y en `.env.example`, no dispersos por la lógica).

### Scenario 2: Proveedor/modelo configurables por env

Given un entorno con `AI_BASE_URL="https://otro-proveedor.example/v1"` y `AI_CHAT_MODEL="chat-pro"`
When se lee la configuración
Then base URL y modelo de chat reflejan los valores de env (la ruta de proveedor/modelo no está cableada).

### Scenario 3: Sin clave, degradación controlada

Given `DEVEXPERT_API_KEY` ausente o vacía (o solo espacios)
When se invoca `getAiStatus()` o una función de IA (`chatCompletion(...)`, `imageEdit(...)`)
Then se devuelve un resultado controlado (`configured: false` / `ok: false` con `code: "ai_disabled"`) con un mensaje claro en español (p. ej. "Las funciones de IA no están disponibles porque falta la clave DEVEXPERT_API_KEY..."), **sin lanzar excepción y sin ninguna llamada de red**.

### Scenario 4: Con clave, cliente OpenAI-compatible configurado por env

Given `DEVEXPERT_API_KEY` definida (aunque sea ficticia en test)
When se solicita el cliente (`createAiClient()`)
Then se construye el cliente oficial `openai` con `apiKey` de env y `baseURL`/modelo de la configuración (sin llamar al gateway en la verificación).

### Scenario 5: Cupo semanal agotado (429) con mensaje claro

Given una respuesta HTTP 429 del proveedor (límite semanal al 100%)
When se normaliza el error en la capa de IA
Then la función devuelve `ok: false` con `code: "ai_quota"` y un mensaje claro (p. ej. "El cupo semanal de IA está agotado y se repone automáticamente..."), sin romper la app.

### Scenario 6: Superficie observable degradada responde 200

Given la app arrancada sin `DEVEXPERT_API_KEY`
When se pide `GET /api/ai/status`
Then responde HTTP 200 con `{ "configured": false, "message": "<mensaje de degradación>" }` (la ausencia de clave no es un error HTTP).

### Scenario 7: La verificación base sigue en verde sin clave

Given los cambios de esta feature (con sus tests) y un `.env` sin clave
When el desarrollador ejecuta `./init.sh`
Then el gate completo (install + db:setup + lint + typecheck + test + build) sale con código 0, sin tocar el gate ni arrancar dev servers.

## Repository Research

### Files Inspected

- `feature_list.json` — alcance/verificación/notas de `ai-provider-config` (DevExpert Inference, `DEVEXPERT_API_KEY`, cliente OpenAI-compatible, 429) y dependencias de `chatbot-*`/`tryon-*` hacia esta feature.
- `PROGRESS.md` — estado verificado (`bootstrap-stack`, `bootstrap-seed`, `catalog-list` en `accepted`); patrón de sesión/evidencia.
- `AGENTS.md` — flujo de arranque y gate estándar (`./init.sh`).
- `docs/technical-discovery.md` — integración DevExpert Inference (`https://inference.devexpert.io/v1`), clave opcional con degradación, cliente oficial `openai` con `apiKey`+`baseURL`, modelos `chat`/`chat-pro`/`image-edit`/`image`/`embedding`, límite semanal con rechazo 429, "la ruta de proveedor/modelo debe ser configurable por env".
- `docs/risks-and-open-questions.md` — riesgos "cupo semanal" y "dependencia de red" (mitigar con modos sin clave y mensajes claros); supuesto de degradación controlada.
- `docs/domain-model.md` — estados `Try-on: Solicitado → Generado|Error` y edge case "fallo del proveedor: error controlado, no romper la página" (consumidores futuros de este contrato).
- `docs/specs/bootstrap-stack.md`, `docs/specs/bootstrap-seed.md`, `docs/specs/catalog-list.md` — estilo/nivel de detalle del spec.
- `ARCHITECTURE.md` — capas actuales (UI, `src/lib`, persistencia, config de entorno), dependencia `src/app → src/components + src/lib → Prisma`; superficie de API routes anticipada pero aún sin usar.
- `CONSTRAINTS.md` — MUST NOT "no commitear claves/secrets (`DEVEXPERT_API_KEY`)" y MUST de `.env`/`.env.example`.
- `package.json` — scripts/gate actuales; dependencias: `@prisma/client`, `next`, `react`, `react-dom` (**sin `openai`**); sin `test:e2e`.
- `init.sh` — gate: install → asegurar `.env` (copia de `.env.example`) → db:setup → lint → typecheck → test → build; sin dev servers.
- `.env.example` (commiteado) y `.env` (local) — ya tienen `DEVEXPERT_API_KEY=` (con comentario de degradación) y `DATABASE_URL`; **no** existen vars `AI_*` para base URL/modelos.
- `src/lib/db.ts` — patrón de "puerta única" (`globalThis` singleton) a imitar para el cliente de IA.
- `src/lib/catalog.ts` — patrón de cliente/dependencia inyectable para tests (`listCatalogProducts(prisma = db)`).
- `src/lib/catalog.test.ts` (vía lectura de `catalog.ts`/specs) y `vitest.config.ts`, `vitest.setup.ts`, `tsconfig.json` — Vitest sin `globals: true`, entorno `jsdom` global con docblock `// @vitest-environment node` para tests de datos/IO, alias `@/* → ./src/*` replicado en Vitest.
- `src/app/page.tsx` / `src/components/*` — solo catálogo; ninguna superficie de IA existe hoy.

Nota: no existen `src/app/api/`, `src/lib/ai/`, ni ningún código de IA. No se inspeccionó `DESIGN.md` en detalle (sin UI en este feature). No existen `docs/mvp-scope.md`, `docs/product-brief.md`, `docs/user-and-access-model.md` ni `docs/adr/*`.

### Existing Patterns To Follow

- **Puerta única por recurso**: Prisma solo desde `src/lib/db.ts`; el SDK `openai` solo desde `src/lib/ai/client.ts` (misma disciplina).
- **Inyección para tests**: funciones que reciben el cliente/config por parámetro con default, testeables sin el singleton ni red (patrón `listCatalogProducts(prisma = db)`).
- **Tests**: Vitest junto al código (`*.test.ts`); entorno `node` vía docblock para tests de IO/rutas; `vi.mock`/`vi.stubEnv` en vez de red o env real (estilo `src/app/page.test.tsx`).
- **UI/mensajes en español**, docs en español; TypeScript estricto; gate desde `./init.sh` sin cambios.
- **Secrets**: `.env` ignorado por git; `.env.example` commiteado con placeholders vacíos y comentarios (ya documenta `DEVEXPERT_API_KEY`).

### Current Gaps

- Sin capa de IA ni cliente: no hay dónde cablear hoy la configuración de proveedor/modelo.
- Dependencia `openai` no instalada.
- `.env.example` no documenta base URL ni modelos (solo la clave).
- Sin ninguna superficie observable de la degradación (no hay API routes ni UI de IA).
- Sin harness E2E (ya decidido: se difiere al primer flujo mutante, ver `ARCHITECTURE.md`).

## Technical Approach

1. **Contrato de entorno** (leído en `src/lib/ai/config.ts`; defaults documentados en código **y** en `.env.example`; todo sobrescribible por env; cadena vacía/espacios = no definido):

   | Variable | Default | Uso |
   |---|---|---|
   | `DEVEXPERT_API_KEY` | (sin default; vacío = modo degradado) | clave personal del gateway |
   | `AI_BASE_URL` | `https://inference.devexpert.io/v1` | endpoint OpenAI-compatible |
   | `AI_CHAT_MODEL` | `chat` | modelo de chat (`chat-pro` vía override/param) |
   | `AI_IMAGE_EDIT_MODEL` | `image-edit` | modelo de edición de imagen |
   | `AI_EMBEDDING_MODEL` | `embedding` | reservado (lo usará `chatbot-recommend`) |

   `getAiConfig()` devuelve `{ baseUrl, apiKey, models: { chat, imageEdit, embedding } }` siempre desde `process.env` (lectura en runtime, no en build/module-level const). `isAiConfigured()` = hay clave no vacía. Nada de endpoints o modelos hardcodeados fuera de estos defaults.
2. **Cliente OpenAI-compatible** (`src/lib/ai/client.ts`): dependencia `openai` (SDK oficial TS). `createAiClient(config = getAiConfig())` devuelve `new OpenAI({ apiKey, baseURL: config.baseUrl })`. Es la única puerta al SDK (como `db.ts` a Prisma). Sin clave no se construye cliente (se degrada antes). No se instancia en import time.
3. **Contrato de resultado y degradación** (`src/lib/ai/errors.ts` + `src/lib/ai/index.ts`):
   - `type AiResult<T> = { ok: true; data: T } | { ok: false; code: "ai_disabled" | "ai_quota" | "ai_error"; message: string }`.
   - Constantes exportadas `AI_MESSAGES` (español, única fuente de copy para chatbot/try-on): `disabled` ("Las funciones de IA no están disponibles porque falta la clave DEVEXPERT_API_KEY. Añádela en .env para activar el chatbot y la prueba virtual."), `quota` ("El cupo semanal de IA está agotado y se repone automáticamente. Vuelve a intentarlo más tarde."), `error` ("No se pudo completar la operación de IA. Inténtalo de nuevo más tarde.").
   - `normalizeAiError(err)`: HTTP 429 → `ai_quota`; cualquier otro fallo → `ai_error` (mensaje genérico; **nunca** se filtra la clave ni el detalle crudo del proveedor en `message`).
4. **Funciones de IA** (`src/lib/ai/index.ts`), transporte + normalización **solo** (sin prompts de dominio, sin contexto de catálogo, sin persistencia):
   - `getAiStatus(): { configured: boolean; message: string }` — `configured=false` + `AI_MESSAGES.disabled` sin clave; sin clave no hay mensaje vacío.
   - `chatCompletion({ messages, model?, client? }): Promise<AiResult<string>>` — sin clave: `ok:false, code:"ai_disabled"` inmediato (sin red). Con clave: `client.chat.completions.create` con `model ?? config.models.chat`; errores vía `normalizeAiError`.
   - `imageEdit({ image, prompt, model?, client? }): Promise<AiResult<string>>` — igual contrato; `model ?? config.models.imageEdit`. Es el primitivo que usará `tryon-result`.
5. **Superficie observable mínima**: `src/app/api/ai/status/route.ts` con `GET()` → `Response.json(getAiStatus(), { status: 200 })` **siempre 200** (sin clave no es error HTTP). Sin esta ruta la degradación no sería verificable end-to-end hasta `chatbot-conversation`; además el futuro widget la puede usar como sonda. Ninguna otra API route en esta feature.
6. **Tests (Vitest, sin red y sin clave)**: el gate debe pasar en un checkout sin secretos.
   - `src/lib/ai/config.test.ts` (`// @vitest-environment node`): defaults (Scenario 1), override por `vi.stubEnv` (Scenario 2), clave vacía/espacios = no configurado.
   - `src/lib/ai/ai.test.ts` (node): sin clave → `getAiStatus()`, `chatCompletion()`, `imageEdit()` degradan con `AI_MESSAGES.disabled` sin excepción y sin construir cliente (`vi.mock("openai")` y assert de no-llamada); con clave → `createAiClient()` recibe `apiKey`+`baseURL` de config (mock del SDK, sin gateway); `normalizeAiError` con error 429 simulado → `ai_quota` (Scenario 5).
   - `src/app/api/ai/status/route.test.ts` (node): invoca `GET()` directamente → 200 + `{ configured: false, message }` sin clave y `configured: true` con clave stubada (Scenarios 6/4).
7. **Documentación de env**: ampliar `.env.example` con las variables `AI_*` comentadas (defaults) y el recordatorio de no commitear la clave. Los defaults de código hacen que un `.env` viejo sin `AI_*` siga funcionando.

## Expected File Changes

- `package.json` — modify; dependencia `openai` (SDK oficial OpenAI-compatible) en `dependencies`.
- `pnpm-lock.yaml` — modify; lockfile actualizado por `pnpm install`.
- `src/lib/ai/config.ts` — create; `getAiConfig()` / `isAiConfigured()` con defaults documentados y lectura en runtime.
- `src/lib/ai/client.ts` — create; `createAiClient()` (única puerta al SDK `openai`).
- `src/lib/ai/errors.ts` — create; `AiResult`, `AI_MESSAGES`, `normalizeAiError()`.
- `src/lib/ai/index.ts` — create; API pública: `getAiStatus()`, `chatCompletion()`, `imageEdit()` (re-exporta `AiResult`/`AI_MESSAGES`).
- `src/lib/ai/config.test.ts`, `src/lib/ai/ai.test.ts` — create; tests sin red/sin clave.
- `src/app/api/ai/status/route.ts` + `src/app/api/ai/status/route.test.ts` — create; `GET` del estado de IA + su test.
- `.env.example` — modify; documentar `AI_BASE_URL`, `AI_CHAT_MODEL`, `AI_IMAGE_EDIT_MODEL`, `AI_EMBEDDING_MODEL` (con defaults) junto a `DEVEXPERT_API_KEY`.
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — update (ver Durable Documentation Impact).
- `feature_list.json`, `PROGRESS.md` — update; evidencia al cerrar la sesión de implementación.
- `init.sh`, `src/app/page.tsx`, `src/components/*`, `prisma/*`, `vitest.config.ts`, `tsconfig.json`, `.gitignore` — **not needed** (el gate ya cubre tests/build; `.env` ya está ignorado; sin UI ni esquema nuevos).

## Visual Design Impact

- UI involved: **no** (sin pantallas, estados ni estilos nuevos; solo JSON de una API route y constantes de texto).
- Design source: not applicable (no se inspeccionó `DESIGN.md` a propósito; no hay UI en este slice).
- Screens or states affected: ninguno. `GET /api/ai/status` es JSON, no una pantalla.
- New design artifact required: no.
- Nota de copy: los mensajes de `AI_MESSAGES` son texto de usuario en español; su renderizado (widget de chat, pantalla de try-on) es alcance de `chatbot-conversation`/`tryon-*`, que deben reutilizar estas constantes en vez de inventar copy nuevo. Por no haber UI, **no aplica** el contrato de verificación visual con Chrome DevTools MCP (la verificación observable es `curl`/test del JSON, ver Verification Plan).

## Durable Documentation Impact

- `ARCHITECTURE.md`: **update** — nueva capa "Acceso a IA" (`src/lib/ai/`: config env-driven, cliente `openai` como única puerta al SDK, contrato `AiResult` + `AI_MESSAGES`, funciones `getAiStatus`/`chatCompletion`/`imageEdit`); primera superficie de API routes (`src/app/api/ai/status`); dependencia `src/app → src/lib/ai → SDK openai → gateway DevExpert`. Registrar decisión de degradación sin clave y normalización de 429.
- `CONSTRAINTS.md`: **update** — MUST nuevos: proveedor/modelo de IA solo desde env (`AI_*`/`DEVEXPERT_API_KEY` con defaults en `src/lib/ai/config.ts`); el SDK `openai` solo se instancia en `src/lib/ai/client.ts`; las funciones de IA nunca lanzan por ausencia de clave (devuelven `AiResult` controlado con `AI_MESSAGES`); sin llamadas de red en tests de IA. MUST NOT: no filtrar claves ni detalles crudos del proveedor en mensajes/logs.
- `AGENTS.md`: **not needed** — ni el flujo de arranque, ni el gate, ni los comandos estándar cambian.
- `docs/technical-discovery.md`: **update** (ligero) — concretar en "Integrations" los nombres de variables decididos (`AI_BASE_URL`, `AI_CHAT_MODEL`, `AI_IMAGE_EDIT_MODEL`, `AI_EMBEDDING_MODEL`); el resto del doc ya describe el gateway y no cambia.
- `docs/risks-and-open-questions.md`: **update** (ligero, opcional) — anotar junto al riesgo "Cupo semanal de IA" que el 429 se centraliza como mensaje controlado en `src/lib/ai` (mitigación parcial; el copy de UI llega con chatbot/tryon).
- `docs/domain-model.md`, `DESIGN.md`, `CONTEXT.md`, `docs/build-brief.md`: **not needed** — sin cambios de dominio ni de dirección visual.
- `PROGRESS.md`, `feature_list.json`: **update** — evidencia de verificación al cerrar la sesión de implementación.

## Implementation Plan

1. Instalar la dependencia `openai` y ampliar `.env.example` con las variables `AI_*` documentadas.
2. Crear `src/lib/ai/config.ts` (defaults + `getAiConfig`/`isAiConfigured`) y su test (`config.test.ts`).
3. Crear `src/lib/ai/errors.ts` (`AiResult`, `AI_MESSAGES`, `normalizeAiError`) y `src/lib/ai/client.ts` (`createAiClient`).
4. Crear `src/lib/ai/index.ts` (`getAiStatus`, `chatCompletion`, `imageEdit`) con degradación sin clave y test `ai.test.ts` (mock del SDK, sin red).
5. Crear `src/app/api/ai/status/route.ts` + `route.test.ts` (siempre 200 con `{ configured, message }`).
6. Ejecutar `./init.sh` completo sin clave y confirmar exit 0; smoke manual de la ruta con y sin clave.
7. Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md` y (ligero) `docs/technical-discovery.md` / `docs/risks-and-open-questions.md`; cerrar con `feature_list.json` (evidence) y `PROGRESS.md`.

## Implementation Tasks

- [ ] Añadir `openai` a `dependencies` (`pnpm add openai`) y confirmar `pnpm-lock.yaml` actualizado.
- [ ] Ampliar `.env.example` con `AI_BASE_URL`, `AI_CHAT_MODEL`, `AI_IMAGE_EDIT_MODEL`, `AI_EMBEDDING_MODEL` (comentadas con defaults) junto a `DEVEXPERT_API_KEY`.
- [ ] Crear `src/lib/ai/config.ts`: `getAiConfig()` (lectura en runtime; vacío/espacios = no definido) e `isAiConfigured()`.
- [ ] Crear `src/lib/ai/config.test.ts` (node): defaults, overrides con `vi.stubEnv`, clave vacía = no configurado.
- [ ] Crear `src/lib/ai/errors.ts`: `AiResult`, `AI_MESSAGES` (copy en español) y `normalizeAiError` (429 → `ai_quota`).
- [ ] Crear `src/lib/ai/client.ts`: `createAiClient(config = getAiConfig())` con `new OpenAI({ apiKey, baseURL })`; única instancia del SDK.
- [ ] Crear `src/lib/ai/index.ts`: `getAiStatus()`, `chatCompletion()`, `imageEdit()` que devuelven `AiResult` y nunca lanzan por falta de clave.
- [ ] Crear `src/lib/ai/ai.test.ts` (node, `vi.mock("openai")`): degradación sin clave (sin excepción, sin llamadas), wiring con clave (apiKey+baseURL), `normalizeAiError` 429.
- [ ] Crear `src/app/api/ai/status/route.ts` (`GET` → 200 `{ configured, message }`) y `route.test.ts`.
- [ ] Ejecutar `./init.sh` en verde **sin** `DEVEXPERT_API_KEY` (sin cambios en el script).
- [ ] Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`, `docs/risks-and-open-questions.md`, `feature_list.json`, `PROGRESS.md`.

## Verification Plan

- `pnpm install` → completa sin errores con la dependencia `openai` nueva (lockfile actualizado).
- `pnpm test` → incluye `src/lib/ai/config.test.ts`, `src/lib/ai/ai.test.ts` y `src/app/api/ai/status/route.test.ts` en verde **con `DEVEXPERT_API_KEY` vacía y sin red** (evidencia: nombres de tests + salida). Debe cubrirse explícitamente: defaults de proveedor/modelo, override por env, degradación sin clave (mensaje `AI_MESSAGES.disabled`, sin throw), wiring `apiKey`+`baseURL` del cliente y 429 → `ai_quota`.
- `pnpm lint` / `pnpm typecheck` / `pnpm build` → exit 0.
- `./init.sh` → exit 0 en un entorno sin clave (el gate copia `.env` de `.env.example` y no debe romperse en modo degradado); **sin** modificar el script ni arrancar dev servers.
- Smoke manual con `pnpm dev` (matar el proceso tras la comprobación):
  - Sin clave: `GET http://localhost:3000/api/ai/status` → HTTP 200, body `{ "configured": false, "message": "<AI_MESSAGES.disabled>" }`.
  - Con clave ficticia (`DEVEXPERT_API_KEY=sk-test-en-.env` y reinicio) → HTTP 200 `{ "configured": true, ... }` (**no** se llama al gateway: `configured` significa "hay clave", no "clave válida"; no se gasta cupo semanal en esta feature).
  - Opcional: reiniciar con `AI_BASE_URL`/`AI_CHAT_MODEL` sobreescritos y verificar (vía test unitario o log sin secretos) que la config los refleja.
- **E2E**: no hay comando E2E persistente (`pnpm test:e2e` no existe; sin Playwright/Cypress) y esta feature no añade UI ni flujos de usuario. La cobertura de Vitest (config, degradación, wiring del cliente y route handler invocado directamente) es suficiente y procedente; el harness E2E sigue diferido al primer flujo mutante (`cart-add`/`product-detail`, decisión ya registrada en `ARCHITECTURE.md`).
- **Verificación visual (Chrome DevTools MCP)**: **no aplica** — esta feature no cambia ninguna pantalla, estado ni estilo (solo JSON de API y constantes de texto). La verificación observable es el smoke `curl`/fetch de `GET /api/ai/status` arriba; el *copy* se valida por aserción en tests sobre `AI_MESSAGES`.
- `init.sh`: no cambia; sigue siendo el gate **no bloqueante** estándar (install + db:setup + lint + typecheck + test + build) y **no** arranca servicios de larga vida.

## Evidence To Capture

- Salida de `pnpm test` con los nombres de los tests nuevos (`src/lib/ai/config.test.ts`, `src/lib/ai/ai.test.ts`, `src/app/api/ai/status/route.test.ts`) y su cobertura de los escenarios 1-6.
- Salida de `./init.sh` (exit 0 **sin clave**), `pnpm lint`, `pnpm typecheck`, `pnpm build`.
- Salida del smoke: `GET /api/ai/status` sin clave → 200 `configured:false` + mensaje de degradación; con clave ficticia → 200 `configured:true` (transcribir el body, sin la clave).
- Confirmación de que `.env.example` documenta `DEVEXPERT_API_KEY` + las 4 variables `AI_*` con defaults, y de que ningún secreto se commitea (`git status` limpio de `.env`).
- Registrar todo en `feature_list.json` (campo `evidence`) y `PROGRESS.md`.

## Validator Checklist

- [ ] La implementación se mantiene dentro del alcance de `ai-provider-config` (config env + cliente + degradación + ruta de estado; sin chatbot, try-on, prompts de dominio, UI, cuotas/reintentos ni harness E2E).
- [ ] Los 7 escenarios de aceptación pasan (defaults; override por env; degradación sin clave sin throw/red; cliente con `apiKey`+`baseURL` de env; 429 → `ai_quota`; `/api/ai/status` 200 en modo degradado; `./init.sh` en verde sin clave).
- [ ] Proveedor/modelo no están cableados: fuera de `src/lib/ai/config.ts` (defaults documentados) no hay URLs ni nombres de modelo hardcodeados, y `AI_BASE_URL`/`AI_*_MODEL` sobrescriben por env.
- [ ] Las funciones de IA (`getAiStatus`/`chatCompletion`/`imageEdit`) nunca lanzan por ausencia de clave: devuelven `AiResult` controlado con `AI_MESSAGES` en español; sin llamadas de red en tests; sin filtrar claves ni detalles crudos del proveedor en mensajes/logs.
- [ ] `openai` solo se instancia en `src/lib/ai/client.ts` (puerta única, al estilo de `src/lib/db.ts`).
- [ ] No se realizan llamadas reales al gateway ni se gasta cupo semanal durante la verificación (con clave ficticia basta para el wiring).
- [ ] `feature_list.json` y `PROGRESS.md` fueron actualizados correctamente (evidencia incluida) y los docs durables (`ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/technical-discovery.md`) reflejan la capa de IA y el contrato de env.
- [ ] No se añadió trabajo de features posteriores ni comportamiento no solicitado.

## Unknowns / Open Questions

- **Shapes reales del gateway**: se asume compatibilidad OpenAI estricta (`/chat/completions`, `/images/edits` multipart) según `docs/technical-discovery.md`; no se ha probado contra `inference.devexpert.io` (requiere clave real y gastaría cupo). La primera llamada real se hará en `chatbot-conversation`/`tryon-result`.
- **`openai` SDK vs `/images/edits` del gateway**: si `images.edit` del SDK no encaja con el multipart del gateway, `tryon-result` podrá usar `fetch` contra `config.baseUrl` reutilizando `src/lib/ai/config.ts` y el mismo contrato `AiResult`; la decisión se registra entonces (no bloquea esta feature: `imageEdit()` ya fija el contrato de entrada/salida).
- **Formato exacto del cuerpo 429**: se normaliza por status HTTP; si el gateway aporta `retry-after`/reset concreto, se puede enriquecer el mensaje en features siguientes sin romper el contrato `ai_quota`.
