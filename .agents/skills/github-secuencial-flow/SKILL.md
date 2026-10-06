---
name: github-secuencial-flow
description: Orquesta features en serie con git y GitHub (gh) reutilizando feature-flow. Usa la misma base para toda la tanda, verifica que las features no dependan entre sí, lanza una sesión opencode run --dir por feature de forma bloqueante (una detrás de otra) y solo publica (push + PR) cuando la feature queda accepted. Use when the user asks for sequential github flow, en serie, una detrás de otra, secuencial, or $github-secuencial-flow.
---

# GitHub Secuencial Flow

Orquesta el ciclo completo de una o varias features combinando `git`, GitHub (`gh`) y el flujo de `$feature-flow`, ejecutándolas **en serie: una detrás de otra**. Cada feature corre en su propia rama, su propio worktree y su propia sesión, pero las sesiones **nunca se lanzan en paralelo**: cada `opencode run` es bloqueante y la siguiente feature no empieza hasta que la anterior termina y su estado queda revisado.

Este documento es el orquestador de nivel superior. No reimplementa el flujo de los subagentes `planner` → `implementer` → `validator` (invocados por su nombre exacto): lo delega a `$feature-flow` dentro de cada sesión independiente.

## Reglas duras

- Una feature por rama, por worktree y por sesión. Nunca dos features en la misma sesión.
- Ejecución estrictamente secuencial. Prohibido lanzar sesiones en paralelo o en background; cada sesión es bloqueante.
- Toda sesión de feature arranca con `opencode run --dir <worktree>` y su prompt manda usar `$feature-flow` para el id seleccionado.
- Misma base para toda la tanda. Todas las features parten del mismo `BASE_SHA` capturado una vez en el preflight para que las PR sean comparables.
- Tanda independiente. Ninguna feature de la tanda puede depender de otra feature de la misma tanda (ver "Preflight"); si lo hace, se excluye y se reporta.
- Sin aceptación no hay publicación. Solo se hace push y PR cuando `feature_list.json` marca la feature como `accepted` y existe evidencia de validación independiente.
- Sin permiso explícito del usuario no hay push. El permiso de push se pide una vez antes de publicar y no se asume.
- El merge queda fuera de alcance. Nunca fusionar la PR ni hacer `gh pr merge`.
- No duplicar ni borrar trabajo: si ya existe issue, worktree, rama o PR, se reutilizan. No se crean duplicados y no se elimina trabajo ajeno.
- Saltar y continuar. Si una feature queda `blocked` o no llega a `accepted`, se registra el motivo y se sigue con la siguiente de la tanda; la tanda no se aborta.
- No arrancar si la base no está limpia. Si `git status --porcelain` está sucio en el checkout principal, parar y pedir al usuario cómo proceder.
- No tocar la rama base `<base>`: nunca commitear ni pushear directamente sobre ella.
- No cambiar en silencio las reglas de verificación del repo durante la orquestación.

## Entrada

- Uno o varios IDs de features (por ejemplo `catalog-filter`, `catalog-sort`), en el orden en que deben ejecutarse en serie.
- Si no se pasa ningún ID: seleccionar una sola feature según las reglas de selección de `$feature-flow` (primero `in_progress`, luego primer `passing`, luego primera lista con dependencias en `accepted`).
- Parámetro opcional `base`: rama base contra la que se abren las PR. Por defecto, la rama actual (`git branch --show-current`). Nunca se asume una rama fija.

## Lectura previa

1. `../../../AGENTS.md`
2. `../../../PROGRESS.md`
3. `feature_list.json`
4. `../../../docs/specs/` si existe
5. `../../../docs/validations/` si existe
6. Estado actual de git (`git status`, `git worktree list`, `git branch -a`, `git branch --show-current`)
7. Estado de `gh` (`gh auth status`)

## Preflight (antes de ejecutar)

Ejecutar y verificar todo esto antes de lanzar cualquier sesión. Si falla la base, los permisos o la resolución de la rama, parar y reportar el bloqueo; no improvisar. Si falla una feature concreta (dependencias), excluirla y seguir con el resto.

1. Confirmar el directorio y la raíz del repositorio:
   - `pwd`
   - `git rev-parse --show-toplevel`
2. Resolver la rama base y capturar el SHA base único para todas las features de esta tanda:
   - `git fetch origin`
   - `<base>` = parámetro `base` si se pasó; si no, `git branch --show-current`.
   - `git rev-parse --verify <base>` (y `origin/<base>` si aplica)
   - `BASE_SHA=$(git rev-parse <base>)`
   - Si `<base>` no existe, parar y pedir al usuario que confirme el nombre. No crearla de oficio.
3. Verificar independencia de la tanda y dependencias externas aceptadas:
   - Para cada feature seleccionada, leer su `depends_on` en `feature_list.json`.
   - Si algún `depends_on` apunta a otro id **dentro de la misma tanda**, excluir esa feature de la tanda y reportar `excluida por dependencia interna en la tanda (<id> depende de <otro-id> de la misma tanda)`. No reordenar de oficio.
   - Todos los `depends_on` restantes (fuera de la tanda) deben existir en `feature_list.json` con estado `accepted`. Si falta alguno, excluir esa feature y reportar la dependencia bloqueante.
4. Verificar base limpia:
   - `git status --porcelain` debe estar vacío en el checkout principal.
   - Si está sucio, parar y pedir al usuario que limpie o confirme cómo proceder. No arrastrar cambios sin commitear a un worktree.
5. Verificar permisos:
   - `gh auth status` con scope `repo` (y `workflow` si el repo lo necesita).
   - Pedir permiso explícito de push al usuario antes de la fase de publicación.
6. Verificar entornos: cada feature tendrá su propio worktree, su propio puerto y su propia base de datos (ver "Worktree y entorno"). En serie no hay colisión, pero se mantiene el esquema aislado por trazabilidad.

## Selección de features

- Si el usuario pasa IDs, usar exactamente esos, en el orden dado, tras aplicar el filtro de independencia del preflight (las excluidas se reportan como `skip` y no se ejecutan).
- Si no pasa IDs: usar las reglas de selección de `$feature-flow` para elegir una sola feature, tomando `<base>` como base.
- Al terminar el preflight, listar el plan en orden de ejecución: `i/N`, id, issue, rama, worktree, puerto y base de datos por feature, más `BASE_SHA` y `<base>`.

## Worktree y entorno por feature

Para cada feature `<id>`:

1. Calcular el `<index>` (0-based) dentro de la tanda y asignar un puerto determinista y una base de datos propia:
   - puerto: `3000 + <index>` (por ejemplo `PORT=3000`, `PORT=3001`, ...).
   - base de datos: `DATABASE_URL="file:./dev-<id>.db"` (aislada por feature).
2. Crear la rama y el worktree desde el mismo `BASE_SHA`, en el subdirectorio dentro del proyecto `.worktrees/<id>` (ruta relativa a la raíz del repo, ignorada por git vía `/.worktrees/` en `.gitignore`):
   - `git worktree add -b feat/<id> .worktrees/<id> <BASE_SHA>`
   - El nombre de rama es `feat/<id>`.
   - Todas las features de la tanda parten del mismo `BASE_SHA` para que las PR sean comparables.
3. Copiar el entorno al worktree:
   - Copiar `.env` si existe (si no, copiar `.env.example` a `.env`) dentro del worktree.
   - Sobrescribir/ajustar en el `.env` del worktree: `PORT` propio y `DATABASE_URL` propia (base de datos aislada).
   - Preparar la base de datos del worktree: `pnpm install` y `pnpm db:setup` (o `./init.sh`) dentro del worktree.
4. Reutilización en reejecuciones:
   - Si `.worktrees/<id>` ya existe y está registrado en `git worktree list`, reutilizarlo tal cual.
   - Si la rama `feat/<id>` ya existe, reutilizarla; no recrearla ni borrarla.
   - No borrar ni reinicializar un worktree con trabajo previo.

## Bucle secuencial con feature-flow

Procesar las features **una detrás de otra, en el orden del plan**. No empezar la siguiente hasta terminar y revisar la actual:

```
para cada <id> (i/N) en orden:
  1. issue -> worktree/rama -> env (según "Worktree y entorno")
  2. opencode run --dir .worktrees/<id> "Usa $feature-flow para la feature <id>. Trabaja solo esa feature hasta aceptación. No hagas push ni PR." (bloqueante, esperar exit)
  3. revisar estado en el worktree (feature_list.json, git log, git status)
  4. publicar solo si accepted (según "Publicación")
  5. limpieza del worktree (según "Limpieza al terminar")
  6. seguir con la siguiente aunque esta quedara blocked/no-accepted
```

Reglas de la sesión:

- El prompt debe pedir explícitamente `$feature-flow` para el `<id>` seleccionado y nada más.
- La sesión corre en modo until-accepted (subagentes `planner` → `implementer` → `validator`, invocados por su nombre exacto), y `$feature-flow` se encarga del commit de aceptación.
- Nunca lanzar dos features en la misma sesión ni compartir contexto entre sesiones.
- No publicar desde la sesión de feature: el push y la PR los decide y ejecuta el orquestador tras confirmar `accepted` y tener permiso.
- Al terminar cada sesión, el orquestador revisa el estado en el worktree (`feature_list.json`, `git log`, `git status`) antes de publicar y antes de pasar a la siguiente.

## Publicación (solo feature accepted)

Publicar una feature solo si se cumplen todas:

1. `feature_list.json` en el worktree marca la feature como `accepted`.
2. Existe evidencia de validación independiente (`$feature-validator` con veredicto `accept`).
3. El usuario dio permiso explícito de push.

Pasos:

1. Revisar rama, commit y evidencia antes de subir:
   - `git -C .worktrees/<id> log --oneline -5`
   - `git -C .worktrees/<id> status --porcelain`
2. Reutilizar la PR si ya existe:
   - `gh pr list --head feat/<id> --state all --json number,url,baseRefName`
   - Si ya existe una PR abierta contra `<base>`, no crear otra; actualizarla solo si hace falta.
3. Push de la rama:
   - `git -C .worktrees/<id> push -u origin feat/<id>`
   - Sin permiso explícito de push, no ejecutar este paso: reportar la feature como "accepted, sin publicar".
4. Crear la PR contra `<base>` con la evidencia, usando `--body-file`:
   - Escribir el cuerpo de la PR en un fichero temporal (por ejemplo `docs/.github-secuencial-flow/<id>-pr.md`) con: resumen, feature id, spec, verificación ejecutada, veredicto del validador, commit(s), issue enlazada y cómo probar.
   - `gh pr create --base <base> --head feat/<id> --title "<id>: <título>" --body-file <ruta-al-body.md>`
   - Enlazar la issue en el cuerpo.
   - No mergear: el merge queda fuera de alcance.

## Idempotencia y reejecución

- Issue: buscar antes de crear con `gh issue list --search "<id>" --state all --json number,title,url`. Si existe, reutilizarla; si no, crearla con `--body-file`.
- Worktree: reutilizar si existe (`git worktree list`); no duplicar ni borrar.
- Rama: reutilizar `feat/<id>` si existe.
- PR: reutilizar si ya hay una PR para `feat/<id>` contra `<base>`.
- Si una feature ya está `accepted` y publicada, no relanzar la sesión ni duplicar PR: reportar el estado actual.

## Issue por feature

Crear o reutilizar la issue antes del worktree. Cuerpo bien formateado, siempre con `--body-file`, nunca con `--body` inline.

Formato sugerido del fichero de cuerpo (`docs/.github-secuencial-flow/<id>-issue.md`):

```
### Contexto
<behavior de la feature y por qué importa>

### Alcance
<qué entra; qué no entra>

### Dependencias
- <id dependencia> (estado)

### Criterios de aceptación
- <verification[] de feature_list.json>

### Evidencia esperada
- <checks + veredicto del validador>

### Referencias
- spec: docs/specs/<id>.md
```

Comando:

```
gh issue create --title "<id>: <título>" --body-file docs/.github-secuencial-flow/<id>-issue.md
```

Reutilizar si ya existe para el mismo `<id>`.

## Limpieza al terminar

Por cada feature, después de su turno (publicada o no):

1. Verificar que el worktree está limpio y que todo está subido:
   - `git -C .worktrees/<id> status --porcelain` vacío.
   - No hay commits locales sin subir (`git -C .worktrees/<id> log origin/feat/<id>..HEAD` vacío).
2. Si está limpio y todo está subido, borrar el worktree conservando la rama:
   - `git worktree remove .worktrees/<id>`
3. Si está sucio o hay commits sin subir, no borrar: dejar el worktree y reportar por qué.

## Salida

Por cada feature, reportar:

- `orden` (`i/N` en la tanda)
- `id`
- rama (`feat/<id>`)
- estado (`accepted` / `passing` / `blocked` / `not_started` / `skip`, y si quedó publicada o no)
- motivo del `skip` cuando aplique (dependencia interna o externa no `accepted`)
- commit (hash y mensaje)
- evidencia (verificación ejecutada y veredicto del validador)
- URL de la PR (o "sin PR" con el motivo)

Al final, resumir la tanda completa en orden: issues, worktrees, ramas y PRs creadas o reutilizadas, y cualquier bloqueo pendiente.
