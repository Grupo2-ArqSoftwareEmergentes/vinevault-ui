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
