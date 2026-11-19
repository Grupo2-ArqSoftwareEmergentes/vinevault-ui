# VineVault UI

## Commands and verification

- Use npm (`packageManager: npm@11.13.0`); install with `npm ci`.
- `npm start` serves the development configuration; `npm run watch` builds development output without serving it.
- `npm run build` defaults to production and runs the environment generator via `prebuild`. Direct `ng build` bypasses that hook.
- Run tests through Angular CLI, not standalone Vitest: `npm test -- --watch=false`. The configured runner is Vitest with jsdom; no browser is required by default.
- Focus a file with `npm test -- --watch=false --include=src/app/app.spec.ts`, or names with `npm test -- --watch=false --filter="suite or test name"` (a regular expression).
- No lint, standalone typecheck, or e2e target is configured; the README's `ng e2e` example is boilerplate. Use the Angular build for compiler/template validation.

## Environment and deployment

- Development uses `src/environments/environment.ts` and defaults to Core at `http://localhost:8000`; setting `API_BASE_URL` does not change `npm start`.
- Production replaces that file with `src/environments/environment.generated.ts`. Set `API_BASE_URL` in the build process environment; `scripts/generate-env.mjs` otherwise falls back to `http://localhost:8000` and does not load `.env` files.
- Do not hand-edit `environment.generated.ts`; change the generator or its input. Route API base URLs through `src/app/api.config.ts` (`API_CONFIG`) rather than hard-coding hosts in features.
- Netlify publishes `dist/vinevault-ui/browser`, not the parent `dist` directory, and rewrites client routes to `index.html` (`netlify.toml`).

## Application wiring

- Standalone bootstrap: `src/main.ts` → `src/app/app.config.ts`. The latter wires routers, HTTP interceptors, and device service injection tokens; new token-based implementations must be registered there.
- Routes and access guards are in `src/app/app.routes.ts`. The `/profile` route redirects to `/overview` despite an existing profile component.
- Feature layering varies: inventory/device use `domain`, `application/internal`, `infrastructure`, and `interfaces`; IAM uses `domain`, `data`, and `presentation`. Follow the affected feature rather than imposing one layout across all features.
- Inventory HTTP resources are mapped to domain data through `interfaces/rest/transform`; keep API payload adaptation at that boundary.
- Authentication headers are centralized in `core/interceptors/auth/auth-interceptor.ts`. IAM login deliberately sends URL-encoded `username`/`password`, not JSON (`iam/data/repositories/auth-repository/auth-repository.ts`).
- Tailwind v4 loads through `@tailwindcss/postcss` and `@import 'tailwindcss'` in `src/styles.css`; there is no Tailwind JS config. Material overlays live outside component hosts: style their `panelClass` in `src/styles.css`, not via unscoped Material overrides.
- Authenticated pages opt into `shared/styles/authenticated-shell.css` with `page-layout authenticated-shell`: viewport height, fixed-height Topbar, stretched sidebar, and scrolling only in the direct `page-body > main`. Do not restore document scrolling with mobile `height: auto`/`overflow: visible` overrides. Wide tables scroll in their own wrappers; short sidebars scroll the nav links, not the logout footer.

## Workspace state and quotas

- Use `WorkspaceContextService` (`shared/services`) for the membership directory and selection, and `WorkspaceAccessService` for permissions. Roles/plans belong to the selected space, not the user profile/JWT; do not replace `/user/context` with owner-only space listings.
- Explicit `spaceId`/`wineCellarId` links win; invalid or mismatched cellar links fail closed. Without an explicit link, context loading retains a valid current selection, restores `vinevault.workspace-selection` from localStorage, then falls back to the first space and its first associated cellar. Preserve selection publication before `whenReady()` resolves; clear persisted state on account changes/logout. Tests seeding storage must clean up this key.
- `workspaceGuard` redirects to onboarding only after a successful empty context response; a failed/offline load is not an empty account. Creation/onboarding responses already include the principal cellar: never POST a second one.
- `WorkspaceScopeService` and `workspaceInterceptor` cancel scoped requests when space/authorization changes. Do not retry cancelled mutations automatically: the server may already have committed them.
- Plans are only `FREE`/`PRO`; `BUSINESS` is a purpose. `space-access.ts` is authoritative over the older plan list in `docs/space-context.md`. Missing roles deny mutations; check handlers as well as `appCan` visibility.
- Quotas/allowances come from the server; `limit === null` means unlimited, missing metadata is unknown. Use `workspace-quota.ts` and whole-space totals, not visible inventory rows or marketing benefits. Subscription/add-on offers are informational, not local entitlement changes; legacy mock checkout is not the subscription flow.
- Quota 403 codes (`SPACE_LIMIT_REACHED`, `CELLAR_LIMIT_REACHED`, `ITEM_LIMIT_REACHED`) preserve session/context and refresh counters, unlike access-revocation 403s. `CellarLimitService` handles cellar upsells; reuse `WineCellarCreationService` for Topbar and management creation. Successful inventory writes already refresh context through `inventoryQuotaRefreshInterceptor`; avoid duplicate refreshes.
- Before changing inventory payloads, editors or stock movements, read `docs/inventory-contract.md`: nullable details/decimal strings, changed-fields-only PATCH, and a single non-retried movement POST are deliberate contracts.
