# EcoBrain AI

EcoBrain AI is an AI-assisted waste collection demo for residents, workers, dispatchers, administrators, and analysts. It includes a Vite/React client, a Hono catch-all API, seeded in-memory demo data, a TypeScript route solver, and an initial Supabase schema migration.

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. On the sign-in page, select a demo role. The shared non-production password is `EcoBrain!2026`; available accounts are `resident@ecobrain.demo`, `worker@ecobrain.demo`, `dispatcher@ecobrain.demo`, `admin@ecobrain.demo`, and `analyst@ecobrain.demo`.

The seeded records and demo sessions live in process memory and reset when the server restarts. Never commit `.env` or paste service-role, Gemini, or other private keys into chat.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover demo-session forgery/expiry, report domain rules, report ownership, worker route authorization, and idempotent stop completion.

## Demo capabilities

- Responsive landing page, role-aware app shell, and resident report wizard.
- Duplicate suggestions, status history, priority factors, AI suggestion UI, and deterministic classifier fallback.
- Dispatcher queue and assignments, custom TypeScript VRP recommendations with comparison metrics, and worker route actions.
- Analytics, hotspots, admin controls, simulated bins, an evaluation status page, and a feature transparency matrix.
- API-side demo authorization, report/photo access checks, validated inputs, and simulated notifications/audit records.

Seeded records carry a `SIMULATED` label. Route and sustainability figures are estimates, and route recommendations require human dispatcher approval.

## Production readiness

The current application API still uses an in-memory store; adding Supabase keys alone does not make its reports, assignments, routes, analytics, or notifications persistent. Do not use it with real resident or operational data until the database-backed API and authorization have been implemented and verified.

The migrations in `supabase/migrations/` define the initial schema and the required PostgREST role grants. Apply them in filename order in the Supabase SQL Editor. The grants migration is needed because the initial schema did not grant table and sequence privileges to the API roles; row-level security policies remain enabled and continue to control authenticated access.

Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only for public client configuration. Keep the Supabase service-role/secret key under the server-only `SUPABASE_SERVICE_ROLE_KEY` name, and keep `GEMINI_API_KEY` server-side. Never use a `VITE_` prefix for a secret or commit `.env`.

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.
