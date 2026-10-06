# Feature Implementation Spec: Configuración del proveedor de IA por entorno

## Source Feature

- `id`: `ai-provider-config`
- `area`: `ai`
- `depends_on`: `["bootstrap-stack"]` (satisfecho; `bootstrap-stack` en `accepted`)
- `status`: `not_started`
- `source`: `feature_list.json`

## Goal

Hacer que toda la IA de la app dependa de una capa de proveedor configurada por variables de entorno, sin nada cableado: URL base del gateway, modelos (`chat`, `chat-pro`, `image-edit`) y la clave `DEVEXPERT_API_KEY`. Sobre esa config, crear las funciones de IA compartidas (chat y edición de imagen contra el gateway OpenAI-compatible de DevExpert Inference) con un contrato de resultado controlado: si falta la clave, si se agota el cupo semanal (429) o si falla red/proveedor, la función **no lanza** y devuelve un mensaje claro en español que las UIs de `chatbot-conversation` y `tryon-result` mostrarán tal cual. El arranque sigue sin servicios externos obligatorios: sin clave, la tienda funciona y solo las funciones de IA degradan.

## Non-Goals

- Sin UI nueva: ningún cambio visible en pantalla (el mensaje de degradación es contrato de texto aquí; lo mostrarán `chatbot-conversation`/`tryon-result`).
- Sin widget de chat, prompts ni inyección de contexto del catálogo: `chatbot-conversation` / `chatbot-recommend`.
- Sin flujo de try-on (subida de foto, aviso de privacidad, persistencia en `TryonImage`, muestra del resultado): `tryon-upload` / `tryon-result`; aquí solo el transporte de `POST /images/edits`.
- Sin embeddings ni búsqueda semántica (research task abierta en `docs/risks-and-open-questions.md`).
- Sin generación pura de imagen (`POST /images/generations`): solo `image-edit`.
- Sin streaming, reintentos/backoff, caché, medición de uso ni cuotas propias (el cupo lo impone el gateway).
- Sin rutas API ni server actions nuevas: la capa es `src/lib/ai`, consumible desde servidor por features posteriores.
- Sin tocar `init.sh` ni el gate de verificación.

## Job Story

When configuro la tienda en local con mi `DEVEXPERT_API_KEY` de AI Expert (o sin ella),
I want que proveedor, URL base y modelos de IA se configuren por variables de entorno y que las funciones de IA degraden con un mensaje claro cuando no hay clave o se agota el cupo,
so I can arrancar sin configuración externa obligatoria y que la IA falle de forma controlada en vez de romper la app.

## Users And Permissions

- **Estudiante/desarrollador**: edita `.env` con su `DEVEXPERT_API_KEY` personal (opcional para arrancar). Único que configura el proveedor.
- **Runtime servidor** (RSC / route handlers / server actions de features futuras): único consumidor de `src/lib/ai`; la clave nunca llega al navegador ni a la UI.
- **Invitado / usuario registrado**: sin interacción directa en esta feature (no hay UI); recibirá los mensajes de degradación en `chatbot-conversation`/`tryon-result`.
- Sin control de acceso (no hay rutas ni datos nuevos).

## Acceptance Scenarios

### Scenario 1: Proveedor/modelo configurables por env (no cableado)

Given `.env` con `AI_PROVIDER_BASE_URL`, `AI_CHAT_MODEL` e `AI_IMAGE_EDIT_MODEL` con valores no por defecto y `DEVEXPERT_API_KEY` definida
When se invocan `completeChat` y `editImage` (con cliente/transporte inyectado en el test)
Then la petición se realiza contra la URL base configurada y con el modelo configurado (sin valores hardcodeados en los puntos de llamada).

### Scenario 2: Defaults documentados del gateway DevExpert

Given `.env` solo con `DEVEXPERT_API_KEY` (sin variables `AI_*` activas)
When se invoca `completeChat` (o `editImage`)
Then se usa `https://inference.devexpert.io/v1` con modelo `chat` (resp. `image-edit`), según los defaults documentados en `.env.example`.

### Scenario 3: Degradación controlada sin clave

Given `.env` sin `DEVEXPERT_API_KEY` (ausente o vacía)
When se invoca cualquier función de IA
Then devuelve `{ ok: false, code: "missing_api_key", message: <mensaje claro en español> }` sin lanzar excepción y sin realizar ninguna llamada de red; el mensaje no contiene la clave.

### Scenario 4: Cupo semanal agotado (429)

Given configuración válida con clave
When el gateway responde 429 (límite semanal agotado)
Then la función devuelve `{ ok: false, code: "quota_exhausted", message: <mensaje claro en español> }` sin lanzar.

### Scenario 5: Fallo de red o del proveedor

Given configuración válida con clave
When la llamada falla por red o el gateway responde error (5xx u otro error no mapeado)
Then la función devuelve `{ ok: false, code: "provider_error", message: <mensaje claro en español> }` sin lanzar y sin filtrar la clave.

### Scenario 6: Env documentados y verificación base en verde

Given los cambios de esta feature
When se inspeccionan `.env.example` (commiteado) y `.env` (local) y se ejecuta `./init.sh`
Then ambos contienen `DEVEXPERT_API_KEY` (sin valores reales) y `.env.example` documenta las variables `AI_*` con sus defaults; `./init.sh` sale con código 0 sin tocar el gate ni arrancar dev servers.

## Repository Research

### Files Inspected

- `feature_list.json` — alcance/verificación de `ai-provider-config`; `chatbot-conversation` y `tryon-result` dependen de esta feature.
- `PROGRESS.md` — estado verificado (`catalog-list` aceptada); el trabajo se ejecuta en el worktree `feat/ai-provider-config`.
- `AGENTS.md` — gate estándar `./init.sh` (install + db:setup + lint + typecheck + test + build).
- `docs/technical-discovery.md` — DevExpert Inference: URL base `https://inference.devexpert.io/v1`, clave `DEVEXPERT_API_KEY`, compatible OpenAI ("cliente oficial `openai` solo cambiando `apiKey` y `baseURL`"), modelos `chat`/`chat-pro`/`image-edit`/`image`/`embedding`, límite semanal con rechazo 429 al 100%, "la ruta de proveedor/modelo debe ser configurable (por env)", sin clave → degradación con mensaje claro.
- `docs/build-brief.md` — success criteria y nota "El proveedor debe ser configurable".
- `docs/risks-and-open-questions.md` — riesgos "cupo semanal" y "dependencia de red" (degradar con claridad); research de embeddings abierta.
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — capas (`src/lib/*`), regla "una sola puerta" (Prisma solo en `src/lib/db`), MUST NOT "no commitear claves"; sin capa IA todavía.
- `CONTEXT.md` — glosario (`Chatbot IA`, `Prueba virtual (Try-on)`).
- `docs/specs/bootstrap-stack.md`, `docs/specs/catalog-list.md` — estilo de spec y convención DI (cliente inyectable por parámetro con default).
- `src/lib/db.ts`, `src/lib/catalog.ts`, `src/lib/format.ts` — convención `src/lib` (singleton/inyección, tests al lado).
- `src/app/page.tsx` — home catálogo (no se toca).
- `package.json` — scripts/gate actuales; **sin `openai`** ni cliente HTTP de IA; **sin `test:e2e`**.
- `.env.example`, `.env` — ya contienen `DEVEXPERT_API_KEY=` (vacío) y `DATABASE_URL`; `.env` está en `.gitignore`.
- `init.sh` — gate no bloqueante (no se modifica).
- `vitest.config.ts` — jsdom por defecto + alias `@/*`; los tests de datos usan docblock `// @vitest-environment node`.
- `DESIGN.md` — revisado solo para confirmar que esta feature no toca UI (los estados de IA se mostrarán con `aria-live` en features futuras).

### Existing Patterns To Follow

- **Clientes inyectables**: `listCatalogProducts(prisma = db)` — las funciones de IA reciben el cliente/transporte por parámetro con default desde config (testeables sin red, sin `vi.mock`).
- **Una sola puerta a un recurso externo** (como `src/lib/db` con Prisma): todo acceso al gateway vive en `src/lib/ai/client.ts`.
- Tests `*.test.ts` al lado del código; docblock `// @vitest-environment node` cuando el módulo lo requiere (patrón de `prisma/seed.test.ts`).
- UI/mensajes en español; docs en español; TypeScript estricto.
- Next.js carga `.env` nativamente en runtime (el `process.loadEnvFile` explícito solo es necesario en scripts sueltos).
- `.env.example` commiteado sin secretos; `.env` ignorado (regla ya en `CONSTRAINTS.md`).

### Current Gaps

- No existe capa de IA (`src/lib/ai` no existe): ni cliente del gateway, ni contrato de resultado/degradación.
- `DEVEXPERT_API_KEY` está en `.env.example` pero nadie la lee; no existen variables de proveedor/modelo (`AI_*`).
- Sin dependencia `openai` (ni alternativa `fetch`) en `package.json`.
- Sin semántica de errores 429/cupo ni mensajes canónicos de degradación.

## Technical Approach

1. **Config por env** (`src/lib/ai/config.ts`), leída en cada invocación mediante `loadAiConfig(env = process.env)` (nunca como constante de módulo):
   - `DEVEXPERT_API_KEY` → `apiKey: string | null` (**vacío o solo espacios = `null`**; `.env.example` la trae vacía).
   - `AI_PROVIDER_BASE_URL` → default `https://inference.devexpert.io/v1`.
   - `AI_CHAT_MODEL` → default `chat`; `AI_CHAT_PRO_MODEL` → default `chat-pro`.
   - `AI_IMAGE_EDIT_MODEL` → default `image-edit`.
   - `isAiConfigured(config)` → `apiKey !== null` (para que features/UI futuras oculten o desactiven la IA).
   Interpretación de "ruta de proveedor/modelo configurable": URL base + modelos por env, de modo que cualquier gateway OpenAI-compatible funcione solo cambiando env. Las rutas relativas `/chat/completions` y `/images/edits` son parte del contrato OpenAI-compatible (fijas respecto a la URL base).
2. **Contrato de resultado** (`src/lib/ai/result.ts`): `AiResult<T> = { ok: true; data: T } | { ok: false; code: AiErrorCode; message: string }` con `AiErrorCode = "missing_api_key" | "quota_exhausted" | "provider_error"` y **mensajes canónicos en español** (fuente única; las UIs futuras muestran `message` tal cual):
   - `missing_api_key`: indica que las funciones de IA necesitan `DEVEXPERT_API_KEY` en `.env` y que la tienda sigue funcionando sin ella.
   - `quota_exhausted`: indica que el cupo semanal de IA se agotó y se reinicia solo.
   - `provider_error`: indica que no se pudo contactar con el servicio de IA; reintentar más tarde.
   Para estos fallos conocidos **no se lanzan excepciones**; jamás se incluye la clave (ni fragmentos) en `message`, logs ni respuestas.
3. **Cliente** (`src/lib/ai/client.ts`): única puerta al gateway. Dependencia nueva **`openai` (SDK oficial)**, construida con `new OpenAI({ apiKey, baseURL })` desde la config: es el camino documentado en `docs/technical-discovery.md` y resuelve JSON de chat y multipart de ediciones de imagen, más la taxonomía de errores (`APIError.status`). *Alternativa descartada*: cliente fino sobre `fetch` (cero dependencias), por artesanal el multipart de `images/edits` y el mapeo de errores que el SDK ya trae.
   - `completeChat({ messages, model? }, client = defaultFromConfig())` → `AiResult<{ content: string }>` sobre `chat.completions.create`; `messages: { role: "system" | "user" | "assistant"; content: string }[]`; modelo por defecto `config.chatModel` (el caller puede pasar `config.chatProModel` para tareas complejas: decidir cuándo es cosa de `chatbot-conversation`).
   - `editImage({ image, prompt, model? }, client = defaultFromConfig())` → `AiResult<{ imageBase64: string }>` sobre `images.edit` (multipart foto+prompt; modelo por defecto `config.imageEditModel`; normalizar la respuesta del gateway a `b64_json`, ver Unknowns). Solo transporte: sin prompt de prenda, sin persistencia, sin aviso de privacidad (features `tryon-*`).
   - Flujo común: sin clave → `aiFailure("missing_api_key")` **sin tocar red**; si el error tiene `status 429` → `quota_exhausted`; cualquier otro error → `provider_error`; éxito → `ok: true`.
   - El parámetro `client` acepta un subconjunto estructural de `OpenAI` (`chat.completions.create`, `images.edit`) para inyectar un stub en tests.
   - **Solo servidor**: `src/lib/ai` se importa desde RSC/route handlers/server actions, nunca desde componentes cliente (la clave no debe empaquetarse para el navegador).
4. **Tests** (Vitest, sin red real; stub de cliente que registra llamadas):
   - `src/lib/ai/config.test.ts`: defaults con env vacío; overrides de URL/modelos; clave vacía o con espacios → `null` e `isAiConfigured` false.
   - `src/lib/ai/client.test.ts`: (a) sin clave → `missing_api_key` y **0 llamadas** al stub; (b) env no por defecto → el stub recibe URL/modelo configurados (prueba el Scenario 1); (c) error con `status 429` → `quota_exhausted`; (d) error de red/5xx → `provider_error`; (e) éxito de chat y de edición → `ok: true` con payload; (f) ningún `message` contiene la clave.
   - Marcar `client.test.ts` con `// @vitest-environment node` si el SDK lo requiere.

**Unknowns explícitos** (no bloquean; registrar hallazgo en "Implementation Findings" al implementar): forma exacta de la respuesta de `POST /images/edits` en DevExpert (`b64_json` vs `url`, ver https://portal.devexpert.io/docs/images); status/cuerpo exactos con los que el gateway señala cupo agotado (se asume 429 según `docs/technical-discovery.md`; si además hay código en el cuerpo, mapearlo también a `quota_exhausted`); compatibilidad total del SDK `openai` con este gateway (el soporte de `baseURL` alternativa es propio del SDK).

## Expected File Changes

- `src/lib/ai/result.ts` — create; `AiResult`, `AiErrorCode`, mensajes canónicos, `aiFailure`.
- `src/lib/ai/config.ts` — create; `loadAiConfig`, `isAiConfigured`, tipos.
- `src/lib/ai/client.ts` — create; `completeChat`, `editImage`, mapeo 429/red, cliente inyectable.
- `src/lib/ai/config.test.ts`, `src/lib/ai/client.test.ts` — create; tests sin red.
- `package.json`, `pnpm-lock.yaml` — modify; dependencia `openai`.
- `.env.example` — modify; mantener `DEVEXPERT_API_KEY=` y añadir `AI_PROVIDER_BASE_URL`, `AI_CHAT_MODEL`, `AI_CHAT_PRO_MODEL`, `AI_IMAGE_EDIT_MODEL` comentadas con su valor por defecto (descomentar para sobrescribir).
- `.env` — modify (local, no commiteado); mismas variables disponibles en el entorno del worktree.
- `ARCHITECTURE.md`, `CONSTRAINTS.md` — update (ver Durable Documentation Impact).
- `docs/risks-and-open-questions.md` — update ligero (ver Durable Documentation Impact).
- `feature_list.json`, `PROGRESS.md` — update; evidencia al cerrar la sesión de implementación.
- `src/app/*`, `src/components/*`, `prisma/*`, `init.sh`, `next.config.ts`, `vitest.config.ts` — **not needed** (sin UI, sin esquema, sin gate nuevo).

## Visual Design Impact

- UI involved: **no** (sin pantallas ni estados visibles nuevos; la feature es capa de config/cliente en `src/lib/ai`).
- Design source: not applicable.
- Screens or states affected: ninguno. Los textos canónicos de degradación que se definen aquí los mostrarán `chatbot-conversation`/`tryon-result` siguiendo `DESIGN.md` (que ya prevé `aria-live` para estados de IA).
- New design artifact required: no.

## Durable Documentation Impact

- `ARCHITECTURE.md`: **update** — nueva subcapa `src/lib/ai` (`config.ts` env-driven, `result.ts` contrato `AiResult`, `client.ts` única puerta al gateway vía SDK `openai`); dirección de dependencia (`src/app`/features → `src/lib/ai` → SDK `openai` → gateway); decisión SDK vs `fetch`; restricción "solo servidor".
- `CONSTRAINTS.md`: **update** — MUST nuevos: (1) proveedor/modelos de IA solo desde `src/lib/ai/config` (URL/modelos nunca hardcodeados en puntos de llamada); (2) las funciones de IA no lanzan para fallos conocidos: devuelven `AiResult` con los mensajes canónicos; (3) `DEVEXPERT_API_KEY` solo en servidor: nunca en UI, bundle cliente ni logs. MUST NOT nuevo: no llamar al gateway fuera de `src/lib/ai/client`.
- `AGENTS.md`: **not needed** — ni flujo de arranque, ni gate, ni artefactos cambian.
- `docs/technical-discovery.md`: **not needed** — ya es la fuente de verdad (URL, clave, modelos, 429, "configurable por env"); esta feature la implementa sin cambiarla.
- `docs/risks-and-open-questions.md`: **update** ligero — anotar que la mitigación "modos sin clave / mensajes claros" del riesgo de cupo ya existe a nivel de lib (`AiResult`), pendiente de su superficie UI en `chatbot-*`/`tryon-*`.
- `docs/domain-model.md`, `CONTEXT.md`, `DESIGN.md`: **not needed** — sin cambios de dominio, glosario ni dirección visual.
- `PROGRESS.md`, `feature_list.json`: **update** — evidencia al cerrar la sesión.

## Implementation Plan

1. Crear `src/lib/ai/result.ts` (tipos + mensajes canónicos + `aiFailure`).
2. Crear `src/lib/ai/config.ts` (`loadAiConfig`, `isAiConfigured`) y `config.test.ts`.
3. Añadir la dependencia `openai` y crear `src/lib/ai/client.ts` (`completeChat`, `editImage` con cliente inyectable y mapeo de errores) + `client.test.ts`.
4. Ampliar `.env.example` (y `.env` local) con las variables `AI_*` documentadas.
5. Ejecutar `./init.sh` completo y confirmar exit 0.
6. Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md` y `docs/risks-and-open-questions.md`; cerrar con `feature_list.json` (evidence) y `PROGRESS.md`.

## Implementation Tasks

- [x] Crear `src/lib/ai/result.ts`: `AiResult`, `AiErrorCode`, mensajes canónicos en español, `aiFailure`.
- [x] Crear `src/lib/ai/config.ts`: `loadAiConfig(env)` (clave trim/`null`; `AI_PROVIDER_BASE_URL`, `AI_CHAT_MODEL`, `AI_CHAT_PRO_MODEL`, `AI_IMAGE_EDIT_MODEL` con defaults) e `isAiConfigured`.
- [x] Crear `src/lib/ai/config.test.ts` (defaults, overrides, clave vacía/espacios).
- [x] `pnpm add openai` (lockfile actualizado; scripts/gate sin cambios).
- [x] Crear `src/lib/ai/client.ts`: `completeChat` e `editImage` sobre SDK `openai` (cliente inyectable); sin clave → sin red; 429 → `quota_exhausted`; resto → `provider_error`.
- [x] Crear `src/lib/ai/client.test.ts` con stub de cliente (los 6 casos del Technical Approach; sin red real).
- [x] Ampliar `.env.example` con `DEVEXPERT_API_KEY` + variables `AI_*` comentadas con sus defaults (sin secretos); reflejar en `.env` local.
- [x] Ejecutar `./init.sh` en verde (sin cambios en el script).
- [x] Actualizar `ARCHITECTURE.md`, `CONSTRAINTS.md`, `docs/risks-and-open-questions.md`, `feature_list.json`, `PROGRESS.md`.

## Verification Plan

- `pnpm test` → incluye `src/lib/ai/config.test.ts` y `src/lib/ai/client.test.ts` en verde (evidencia: nombres de tests + salida).
- `pnpm lint`, `pnpm typecheck`, `pnpm build` → exit 0; `./init.sh` → exit 0 (install + db:setup + lint + typecheck + test + build), **sin** modificar el script y sin dev servers.
- **Prueba de "no cableado" (Scenarios 1/2)**: grep del repo — `https://inference.devexpert.io` y los ids de modelo solo deben aparecer como defaults en `src/lib/ai/config.ts`, en `.env.example`/docs y en los tests que los afirman; **nunca** en `src/lib/ai/client.ts` ni en puntos de llamada. Además, el test con env no por defecto confirma que el transporte recibe URL/modelo de env.
- **Degradación (Scenarios 3/4/5)**: evidencia de los tests (sin clave → `missing_api_key` con 0 llamadas de red; 429 → `quota_exhausted`; red/5xx → `provider_error`; ningún mensaje contiene la clave). Smoke manual opcional: `pnpm dev` sin `DEVEXPERT_API_KEY` → `http://localhost:3000/` sigue respondiendo HTTP 200 (la app no se rompe sin IA).
- **Env (Scenario 6)**: fragmento de `.env.example` y `.env` con `DEVEXPERT_API_KEY` presente (vacía, sin valores reales) y variables `AI_*` documentadas.
- **E2E**: no hay comando E2E persistente (`pnpm test:e2e` no existe). No se introduce harness: la feature no cambia UI, routing ni flujos de usuario (capa de lib en servidor) y la decisión registrada en `ARCHITECTURE.md` mantiene el E2E diferido al primer flujo mutante (`cart-add`/`product-detail`). La cobertura unitaria con cliente inyectado cubre el contrato completo (config, degradación, mapeo de errores) sin red.
- **Verificación visual con Chrome DevTools MCP**: **no aplica** — la feature no cambia ninguna pantalla, estado ni estilo (UI involved: no). Basta el smoke de regresión opcional citado arriba.
- `init.sh`: sin cambios; sigue siendo el gate **no bloqueante** estándar y **no** arranca servicios de larga vida.

## Evidence To Capture

- Salida de `pnpm test` con los nombres de los tests nuevos (`src/lib/ai/config.test.ts`, `src/lib/ai/client.test.ts`) y los casos de degradación (`missing_api_key` / `quota_exhausted` / `provider_error`).
- Salida de `./init.sh` (exit 0) y de `pnpm lint` / `pnpm typecheck` / `pnpm build`; versión de `openai` en `package.json`/`pnpm-lock.yaml`.
- Resultado del grep de "no cableado" (URL/modelos fuera de `src/lib/ai/config.ts` solo en tests/docs/`.env.example`).
- Fragmento de `.env.example` (y `.env`) con `DEVEXPERT_API_KEY` + variables `AI_*`.
- Los tres mensajes canónicos de degradación (texto exacto) como referencia para `chatbot-conversation`/`tryon-result`.
- Registrar todo en `feature_list.json` (campo `evidence`) y `PROGRESS.md`.

## Validator Checklist

- [ ] La implementación se mantiene dentro del alcance: sin UI, sin flujos de chat/try-on, sin prompts ni contexto de catálogo, sin embeddings, sin streaming ni reintentos, sin tocar `init.sh`.
- [ ] Los 6 escenarios de aceptación pasan (config por env con overrides; defaults de DevExpert; sin clave → `missing_api_key` sin red; 429 → `quota_exhausted`; red/5xx → `provider_error`; env documentados + `./init.sh` en verde).
- [ ] La ruta de proveedor/modelo no está cableada: URL/modelos solo en `src/lib/ai/config.ts` (defaults) + env (comprobable por grep y por test con env no por defecto).
- [ ] `.env` y `.env.example` contienen `DEVEXPERT_API_KEY` (sin secretos reales) y `.env.example` documenta las variables `AI_*`.
- [ ] Las funciones de IA no lanzan para fallos conocidos: devuelven `AiResult` con mensajes claros en español; la clave jamás aparece en mensajes, logs ni respuestas.
- [ ] La dependencia `openai` se usó según lo planeado (o la desviación quedó registrada en "Implementation Findings" de este spec).
- [ ] La justificación de no-E2E y de no-verificación-visual se acepta y quedó registrada.
- [ ] `feature_list.json` y `PROGRESS.md` fueron actualizados correctamente (evidencia incluida).
- [ ] No se añadió trabajo de features posteriores ni comportamiento no solicitado.

## Implementation Findings

- **SDK `openai` v7.28.0** instalado y usado como única puerta (`src/lib/ai/client.ts`). El tipo `OpenAI` es estructuralmente asignable al subconjunto `AiClient` declarado (verificado por `pnpm typecheck`), de modo que los tests inyectan un stub sin `vi.mock` ni red.
- **`client` como parámetro opcional** (no default parameter): el SDK `openai` lanza al construir el cliente con `apiKey` vacía. Para conservar "sin clave → `missing_api_key` sin tocar la red", `completeChat`/`editImage` leen la config, comprueban la clave y solo entonces construyen el cliente por defecto (`createOpenAiClient(config)`). El contrato observable (cliente inyectable por parámetro, default desde config) se mantiene.
- **Tipo de entorno (`AiEnv`)**: Next.js tipa `NodeJS.ProcessEnv` con `NODE_ENV` obligatorio; por eso `loadAiConfig` acepta `Record<string, string | undefined>` y permite entornos parciales en tests.
- **Normalización de `POST /images/edits`** (Unknown resuelto a nivel de contrato): el cliente acepta `b64_json` (preferido) o `url`; si solo viene `url`, se descarga y se convierte a base64 para que `editImage` devuelva siempre `{ imageBase64 }`. Si no hay imagen → `provider_error`.
- **Mapeo de cupo agotado**: se trata como `quota_exhausted` cuando `status === 429` o cuando `code`/`type` del error contienen `quota`/`rate_limit`. El código exacto del cuerpo del gateway no se pudo confirmar (no se usó ninguna clave real ni se hicieron llamadas de red); queda cubierto por test de ambos caminos.
- **Sin E2E ni verificación visual**: la feature es capa de lib en servidor, sin UI, routing ni flujo de usuario (`Visual Design Impact: no`). No existía `pnpm test:e2e`; no se introduce harness y la cobertura unitaria con cliente inyectado cubre el contrato completo (config, degradación, mapeo de errores) sin red. Smoke de regresión: `pnpm dev` sin `DEVEXPERT_API_KEY` → `GET /` responde HTTP 200 (la app no se rompe sin IA).