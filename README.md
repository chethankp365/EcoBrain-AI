# EcoBrain AI

EcoBrain AI is an AI-assisted waste collection demo for residents, workers, dispatchers, administrators, and analysts. It includes a Vite/React client, a Hono catch-all API, seeded in-memory demo data, a TypeScript route solver, and an initial Supabase schema migration.

## Run locally

Requirements: Node.js 20 or newer and npm.

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite. Real mode is the default. Configure the server/public Supabase keys in `.env`, then apply the migrations listed below before signing up. Demo accounts are available only when you explicitly set `DEMO_MODE=true`; the shared non-production password is `EcoBrain!2026`.

The demo seed and demo sessions live in process memory and reset when the server restarts. Never commit `.env` or paste service-role, Gemini, or other private keys into chat.

## Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

Tests cover demo-session forgery/expiry, report domain rules, report ownership, worker route authorization, and idempotent stop completion.

## Demo capabilities

These seeded workflows are available only when `DEMO_MODE=true` and are not live operational data:

- Responsive landing page, role-aware app shell, and resident report wizard.
- Duplicate suggestions, status history, priority factors, AI suggestion UI, and deterministic classifier fallback.
- Dispatcher queue and assignments, custom TypeScript VRP recommendations with comparison metrics, and worker route actions.
- Analytics, hotspots, admin controls, simulated bins, an evaluation status page, and a feature transparency matrix.
- API-side demo authorization, report/photo access checks, validated inputs, and simulated notifications/audit records.

Seeded records carry a `SIMULATED` label. Route and sustainability figures are estimates, and route recommendations require human dispatcher approval.

## Production readiness

Real mode now uses Supabase Auth for account creation, sign-in, recovery, refresh, and profile updates. Resident/worker reports, report photos, report history, and Gemini classifications use Supabase-backed storage. Dispatch, fleet, route planning, worker tracking, analytics, notifications, hotspots, and sensor ingestion are intentionally unavailable in real mode until those features are connected to real configured operational records; the API returns an explicit unavailable response instead of demo data.

Apply every migration in `supabase/migrations/` in filename order in the Supabase SQL Editor. This includes the PostgREST role grants, generated report coordinates, service-area validation, and the selected pilot boundary. Row-level security remains enabled.

Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` only for public client configuration. Keep the Supabase service-role/secret key under the server-only `SUPABASE_SERVICE_ROLE_KEY` name, and keep `GEMINI_API_KEY` server-side. Never use a `VITE_` prefix for a secret or commit `.env`.

The initial pilot is the current Greater Bengaluru Authority feature `1 - Ramaswamy Palya` (`corporation_id=1`, Dec 2025 delimitation), not a claim that every historic BBMP Ward 1 boundary is equivalent. Its source and attribution are recorded in the seed migration. No vehicles, workers, bins, depots, or historical reports are fabricated; operational modules require those records to be supplied before they can be enabled.

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
