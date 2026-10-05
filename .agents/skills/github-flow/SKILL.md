---
name: github-flow
description: Orquesta el flujo completo por feature con git y GitHub (gh) reutilizando feature-flow. Crea o reutiliza la issue, la rama y un worktree aislado en .worktrees/<id>, lanza una sesión independiente con `opencode run --dir <worktree>` que usa $feature-flow, y solo publica (push + PR contra demo/seed) cuando la feature queda accepted. Use when the user asks to run the github flow, create issues/worktrees per feature, run the feature flow in parallel worktrees, or publish accepted features as PRs from feature_list.json.
---

# GitHub Flow

Orquesta el ciclo completo de una o varias features combinando `git`, GitHub (`gh`) y el flujo de `$feature-flow`. Cada feature corre en su propia rama, su propio worktree y su propia sesión, para que varias features circulen en paralelo sin pisarse.

Este documento es el orquestador de nivel superior. No reimplementa el flujo planner → implementer → validator: lo delega a `$feature-flow` dentro de cada sesión independiente.

## Reglas duras

- Una feature por rama, por worktree y por sesión. Nunca dos features en la misma sesión.
- Toda sesión de feature arranca con `opencode run --dir <worktree>` y su prompt manda usar `$feature-flow` para el id seleccionado.
- Sin aceptación no hay publicación. Solo se hace push y PR cuando `feature_list.json` marca la feature como `accepted` y existe evidencia de validación independiente.
- Sin permiso explícito del usuario no hay push. El permiso de push se pide una vez antes de publicar y no se asume.
- El merge queda fuera de alcance. Nunca fusionar la PR ni hacer `gh pr merge`.
- No duplicar ni borrar trabajo: si ya existe issue, worktree, rama o PR, se reutilizan. No se crean duplicados y no se elimina trabajo ajeno.
- No arrancar si la base no está limpia o si alguna dependencia no está `accepted`.
- No tocar la rama base `demo/seed`: nunca commitear ni pushear directamente sobre ella.
- No cambiar en silencio las reglas de verificación del repo durante la orquestación.

## Entrada

- Uno o varios IDs de features (por ejemplo `catalog-list`, `catalog-filter`).
- Si no se pasa ningún ID: usar el repositorio actual, la rama base `demo/seed` y la siguiente feature disponible según las reglas de selección de `$feature-flow`.

## Lectura previa

1. `../../../AGENTS.md`
2. `../../../PROGRESS.md`
3. `feature_list.json`
4. `../../../docs/specs/` si existe
5. `../../../docs/validations/` si existe
6. Estado actual de git (`git status`, `git worktree list`, `git branch -a`)
7. Estado de `gh` (`gh auth status`)

## Preflight (antes de ejecutar)

Ejecutar y verificar todo esto antes de lanzar cualquier sesión. Si algo falla, parar y reportar el bloqueo; no improvisar.

1. Confirmar el directorio y la raíz del repositorio:
   - `pwd`
   - `git rev-parse --show-toplevel`
2. Confirmar la rama base y capturar el SHA base único para todas las features de esta tanda:
   - `git fetch origin`
   - `git rev-parse --verify demo/seed` (y `origin/demo/seed` si aplica)
   - `BASE_SHA=$(git rev-parse demo/seed)`
   - Si `demo/seed` no existe, parar y pedir al usuario que la cree o confirme el nombre.
3. Verificar dependencias aceptadas: para cada feature seleccionada, todos los ids de `depends_on` deben existir en `feature_list.json` con estado `accepted`. Si falta alguna, no seleccionar esa feature y reportar la dependencia bloqueante.
4. Verificar base limpia:
   - `git status --porcelain` debe estar vacío en el checkout principal.
   - Si está sucio, parar y pedir al usuario que limpie o confirme cómo proceder. No arrastrar cambios sin commitear a un worktree.
5. Verificar permisos:
   - `gh auth status` con scope `repo` (y `workflow` si el repo lo necesita).
   - Pedir permiso explícito de push al usuario antes de la fase de publicación.
6. Verificar entornos independientes: cada feature tendrá su propio worktree, su propio puerto y su propia base de datos (ver "Worktree y entorno"). Confirmar que no hay colisión de puertos ni de ficheros `.db`.

## Selección de features

- Si el usuario pasa IDs, usar exactamente esos, en el orden dado, verificando el preflight de cada uno.
- Si no pasa IDs: usar las reglas de selección de `$feature-flow` (primero `in_progress`, luego el primer `passing`, luego la primera feature lista cuyas dependencias estén `accepted`), tomando `demo/seed` como base.
- Al terminar el preflight, listar el plan: id, issue, rama, worktree, puerto y base de datos por feature.

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

## Sesión independiente con feature-flow

Lanzar exactamente una sesión por feature, en su propio worktree:

```
opencode run --dir .worktrees/<id> "Usa $feature-flow para la feature <id>. Trabaja solo esa feature hasta aceptación. No hagas push ni PR."
```

Reglas de la sesión:

- El prompt debe pedir explícitamente `$feature-flow` para el `<id>` seleccionado y nada más.
- La sesión corre en modo until-accepted (planner → implementer → validator), y `$feature-flow` se encarga del commit de aceptación.
- Nunca lanzar dos features en la misma sesión ni compartir contexto entre sesiones.
- No publicar desde la sesión de feature: el push y la PR los decide y ejecuta el orquestador tras confirmar `accepted` y tener permiso.
- Al terminar la sesión, el orquestador revisa el estado en el worktree (`feature_list.json`, `git log`, `git status`) antes de publicar.

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
   - Si ya existe una PR abierta contra `demo/seed`, no crear otra; actualizarla solo si hace falta.
3. Push de la rama:
   - `git -C .worktrees/<id> push -u origin feat/<id>`
   - Sin permiso explícito de push, no ejecutar este paso: reportar la feature como "accepted, sin publicar".
4. Crear la PR contra `demo/seed` con la evidencia, usando `--body-file`:
   - Escribir el cuerpo de la PR en un fichero temporal (por ejemplo `docs/.github-flow/<id>-pr.md`) con: resumen, feature id, spec, verificación ejecutada, veredicto del validador, commit(s), issue enlazada y cómo probar.
   - `gh pr create --base demo/seed --head feat/<id> --title "<id>: <título>" --body-file <ruta-al-body.md>`
   - Enlazar la issue en el cuerpo.
   - No mergear: el merge queda fuera de alcance.

## Idempotencia y reejecución

- Issue: buscar antes de crear con `gh issue list --search "<id>" --state all --json number,title,url`. Si existe, reutilizarla; si no, crearla con `--body-file`.
- Worktree: reutilizar si existe (`git worktree list`); no duplicar ni borrar.
- Rama: reutilizar `feat/<id>` si existe.
- PR: reutilizar si ya hay una PR para `feat/<id>` contra `demo/seed`.
- Si una feature ya está `accepted` y publicada, no relanzar la sesión ni duplicar PR: reportar el estado actual.

## Issue por feature

Crear o reutilizar la issue antes del worktree. Cuerpo bien formateado, siempre con `--body-file`, nunca con `--body` inline.

Formato sugerido del fichero de cuerpo (`docs/.github-flow/<id>-issue.md`):

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
gh issue create --title "<id>: <título>" --body-file docs/.github-flow/<id>-issue.md
```

Reutilizar si ya existe para el mismo `<id>`.

## Limpieza al terminar

Por cada feature, después de publicar:

1. Verificar que el worktree está limpio y que todo está subido:
   - `git -C .worktrees/<id> status --porcelain` vacío.
   - No hay commits locales sin subir (`git -C .worktrees/<id> log origin/feat/<id>..HEAD` vacío).
2. Si está limpio y todo está subido, borrar el worktree conservando la rama:
   - `git worktree remove .worktrees/<id>`
3. Si está sucio o hay commits sin subir, no borrar: dejar el worktree y reportar por qué.

## Salida

Por cada feature, reportar:

- `id`
- rama (`feat/<id>`)
- estado (`accepted` / `passing` / `blocked` / `not_started`, y si quedó publicada o no)
- commit (hash y mensaje)
- evidencia (verificación ejecutada y veredicto del validador)
- URL de la PR (o "sin PR" con el motivo)

Al final, resumir el plan completo: issues, worktrees, ramas y PRs creadas o reutilizadas, y cualquier bloqueo pendiente.
