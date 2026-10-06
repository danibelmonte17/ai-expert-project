# Validation Record: product-detail

- Feature id: `product-detail`
- Spec: `docs/specs/product-detail.md`
- Claimed status in `feature_list.json`: `passing` (ready for validation)
- Validator verdict: **accept**
- Date: 2026-10-06
- Validator runtime: opencode feature-validator subagent (independent of implementer)

## Review Target

- Feature: ficha `/productos/[slug]` con selector talla/color sobre la matriz sparse,
  estado `Disponible`/`Agotada` derivado de stock, 404 por slug, card del catálogo como enlace,
  CTA "Añadir al carrito" solo-estado (sin acción, es `cart-add`).
- Diff inspected: modified `ARCHITECTURE.md`, `PROGRESS.md`, `feature_list.json`,
  `src/components/product-card.{tsx,module.css,test.tsx}`, `src/lib/catalog.{ts,test.ts}`;
  new `src/lib/variants.{ts,test.ts}`, `src/components/{variant-selector,product-detail}.{tsx,module.css,test.tsx}`,
  `src/app/productos/[slug]/{page.tsx,page.test.tsx}`, `docs/specs/product-detail.md`.
- Confirmed unchanged: `package.json`, `pnpm-lock.yaml`, `prisma/*`, `init.sh`, `vitest.config.ts`,
  `src/app/globals.css`, `CONSTRAINTS.md`, `AGENTS.md` (no new dependencies, schema, migration, seed or gate changes).

## Commands Run And Results (rerun by validator)

| Command | Result |
| --- | --- |
| `pnpm lint` | exit 0 |
| `pnpm typecheck` | exit 0 |
| `pnpm test` | exit 0 — 9 files / 44 tests; `src/app/productos/[slug]/page.test.tsx` IS collected |
| `pnpm build` | exit 0 — `/productos/[slug]` dynamic (ƒ), `/_not-found` static (○), `/` dynamic (ƒ) |
| `./init.sh` (Git Bash, `C:\Program Files\Git\bin\bash.exe`) | exit 0 — install + db:setup + lint + typecheck + test + build; no dev servers |
| Runtime smoke | `/productos/camiseta-basica` 200, `/` 200 (8 product links), `/productos/no-existe` 404 |

Note: the `bash` on PATH in this sandbox is the WSL stub (no distro); `./init.sh` was run with Git Bash, same as the implementer.

## Visual Verification (Chrome DevTools MCP not exposed → documented fallback)

The `chrome-devtools` MCP tools (`navigate_page`/`take_snapshot`/`take_screenshot`/`list_console_messages`)
were **not exposed** in this validator runtime. Per the spec's Verification Plan, the documented fallback was used:
real Chrome 154 (headless) driven through the DevTools Protocol (CDP), capturing equivalent snapshots,
screenshots and console/network messages. The dev server ran on port 3200 (3000 was occupied by another worktree).

Snapshot results (DOM-level verification):

- `/` catalog: `h1` "Catálogo"; 8 cards linking to `/productos/<slug>` (all 8 slugs present).
- `/productos/camiseta-basica` (no selection): `h1` "Camiseta básica", "Camisetas", description,
  "19,99 €"; Talla chips S/M/L/XL, Color chips negro/blanco/azul/rojo; hint
  "Selecciona talla y color para ver el stock."; CTA "Añadir al carrito" `disabled`.
- After click Talla=S: color blanco/azul/rojo become `disabled` (sparse matrix, no phantom variants).
- After click Color=negro: aria-live "Disponible · 12 en stock"; CTA enabled (`disabled=false`).
- `/productos/camiseta-estampada` after S + negro: aria-live "Agotada" (danger); CTA `disabled`;
  chips S and negro marked `data-sold-out="true"` but still selectable.
- `/productos/no-existe`: document title "404: This page could not be found.", `h1` "404".

Screenshots (PNG, verified signature `89504e47...` and dimensions):

- `docs/evidence/product-detail-desktop-1280.png` — 1280×800 (after S/negro, badge Disponible).
- `docs/evidence/product-detail-mobile-375.png` — 375×667 (ficha apilada, sin selección).
- `docs/evidence/product-detail-agotada-desktop-1280.png` — 1280×800 (estampada S/negro, Agotada).

Console / network: only React DevTools `info` messages. The only `error`-level entries are
network 404s for `/favicon.ico` (pre-existing, already recorded as out-of-scope for `catalog-list`)
and for the `/productos/no-existe` document itself (the intended 404). **No 404 of `/images/products/*.svg`.**

## Acceptance Scenarios

| Scenario | Result |
| --- | --- |
| 1. Ficha con imagen/descripción/precio/variantes, CTA disabled | PASS |
| 2. S/negro → variante correcta + "Disponible · 12 en stock" + precio | PASS |
| 3. Estampada S/negro → "Agotada" + CTA disabled | PASS |
| 4. Combinaciones inexistentes no seleccionables (sin variantes fantasma) | PASS (see Low finding L1 on rule 4c) |
| 5. Slug desconocido → 404 | PASS |
| 6. `./init.sh` en verde | PASS |

## Findings

### L1 — Scenario 4 cleanup rule (4c) is not reachable through the UI

- Severity: Low (documented deviation; non-blocking)
- Evidence: `src/lib/variants.ts` `nextSelection` + `src/components/variant-selector.tsx`
  symmetric `disabled`; `docs/specs/product-detail.md` Implementation Findings and PROGRESS Session 005.
- Why it matters: the spec's illustrative path ("color blanco y después talla S") cannot be performed
  because the S chip is already `disabled` once blanco is selected. The observable guarantee
  ("en ningún caso se resuelve una variante inexistente") is actually stronger in practice.
- Required change: none required for acceptance. The cleanup helper is implemented and unit-tested
  (`nextSelection`, `variants.test.ts`), and the UI test asserts non-existent combinations are `disabled`.
- Verification: DOM snapshot confirmed `disabled` on incompatible chips; `pnpm test` green.

### L2 — `/favicon.ico` 404 (informational, pre-existing)

- Severity: Low
- Evidence: console/network log; already recorded as out-of-scope in the `catalog-list` validation.
- Required change: none for this feature.

### I1 — Next.js "multiple lockfiles" warning (informational, environmental)

- Severity: Low
- Evidence: `pnpm build` / `./init.sh` output; caused by the `.worktrees` directory tree, not this feature.

## Validator Checklist Status

- [x] Scope limited to `product-detail` (no cart/checkout, no try-on UI, no filters/sort, no header/nav/chatbot, no E2E harness).
- [x] 6 acceptance scenarios pass.
- [x] "Añadir al carrito" does NOT add anything (no handler); contract is only the `disabled` state.
- [x] `Disponible`/`Agotada` derived from `stock` (no new fields/migrations); price via `formatPrice`.
- [x] Detail read from SQLite via `src/lib/catalog` (`getProductDetailBySlug`, injectable client); chips respect the sparse matrix.
- [x] Visual evidence captured by validator (3 PNGs + snapshots + clean console; MCP fallback stated).
- [x] Non-E2E justification accepted; E2E milestone corrected to `cart-add` in `ARCHITECTURE.md`.
- [x] `feature_list.json` and `PROGRESS.md` updated with evidence.
- [x] No later-feature work or unrequested behavior.

## Security Assessment (feature-scoped)

- No secrets committed; no new dependencies.
- Read-only public detail page; the only external input is the `slug` from the URL, passed to
  `prisma.product.findUnique({ where: { slug } })` (parameterized ORM query → no injection);
  unknown slug → `notFound()`.
- Client/server boundary clean: the RSC fetches and passes a DTO; the `"use client"` components
  never import Prisma. Only `src/lib/db.ts` instantiates `PrismaClient`.
- No security findings requiring action.

## Documentation / Harness

- `ARCHITECTURE.md` updated: `/productos/[slug]` RSC + `force-dynamic` + `notFound`, client boundary,
  `src/lib/variants.ts`, try-on anchor, and the E2E milestone corrected to `cart-add`.
- `CONSTRAINTS.md` / `AGENTS.md` correctly left unchanged (rules already cover the implementation).
- Durable docs do not contradict the implemented behavior.

## Recommended State Update

The orchestrator should set `product-detail` status to `accepted` in `feature_list.json` with this
validation as evidence. This validator did **not** modify `feature_list.json` status and did **not** create a commit.

## Next Step

`catalog-filter` (or the next not-started feature). Requires the `planner` role.
