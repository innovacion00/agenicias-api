---
name: run-agencias-api
description: Build, run, smoke-test, and drive the agencias-api NestJS REST API. Use when asked to start/run/boot the agencias API, build it, run its tests, hit its endpoints, screenshot its Swagger UI, or confirm a change works against the running server.
---

`agencias-api` is a NestJS 10 REST API (travel-agency back office: reservas,
cotizaciones, vuelos, auth) served under the global prefix `agencias/v1/`.
Drive it with **`.claude/skills/run-agencias-api/driver.mjs`** — a Node script
that boots an **in-memory MongoDB** and launches the app with **dummy env
vars**, so you never need the real `.env`, never touch the production database,
and never call the external integrations (Cobre, Cloudinary, Amadeus, MaarLab,
My Tool, SendGrid, Gmail). The driver runs HTTP smoke checks and exits, or stays
up in `serve` mode for manual probing / Swagger UI.

All paths below are relative to the repo root (`agencias-api/`). Commands were
run on Windows + PowerShell with Node v22.18.0; the driver itself is OS-agnostic
Node (no PowerShell/bash specifics).

## Prerequisites

- **Node.js ≥ 18** (verified on v22.18.0), npm (v11.8.0).
- `npm install` — the only system dependency. It downloads two binaries the
  first time (needs network **once**), both then cached and reused offline:
  - `mongodb-memory-server` → a `mongod` binary under
    `node_modules/.cache/mongodb-memory-server/` (here: `mongod-x64-win32-8.2.1.exe`).
  - `puppeteer` → Chromium under `~/.cache/puppeteer/` (only needed for the
    optional Swagger screenshot).
- **No MongoDB install needed** — the driver supplies an in-memory one.

```powershell
npm install
```

## Build

The driver runs the compiled output, so build first (produces `dist/main.js`):

```powershell
npm run build
```

## Run (agent path) — the driver

One command: boots in-memory Mongo → launches the app with dummy env → polls
until ready → runs read-only smoke checks → tears everything down. Exit code 0 =
all checks passed.

```powershell
node .claude\skills\run-agencias-api\driver.mjs
```

Expected tail (verified this session):

```
[driver] server up at http://127.0.0.1:3000/agencias/v1

[driver] running smoke checks:
  PASS  GET /api-docs-json returns OpenAPI 200 — 106 routes documented
  PASS  GET /api-docs serves Swagger UI — 3254 bytes html
  PASS  POST /auth/sign-in bad creds -> 401 — unauthorized as expected (DB query path works)
  PASS  POST /auth/sign-in empty body -> 400 — ValidationPipe rejected empty payload
  PASS  GET /cotizaciones/public/:id missing -> 4xx — status 404 for unknown cotizacion

[driver] ALL CHECKS PASSED
```

### Serve mode — keep it running to poke by hand

```powershell
node .claude\skills\run-agencias-api\driver.mjs serve
```

Prints the URLs and stays up (Ctrl-C to stop). Then hit it from another shell:

```powershell
Invoke-WebRequest http://127.0.0.1:3000/agencias/v1/api-docs-json -UseBasicParsing | Select-Object StatusCode
```

| invocation | what it does |
|---|---|
| `node .claude\skills\run-agencias-api\driver.mjs` | boot + 5 smoke checks + teardown; exit 0/1 |
| `node .claude\skills\run-agencias-api\driver.mjs serve` | boot + stay up at `:3000` for manual curl / Swagger UI |
| `$env:AGENCIAS_PORT=3100; node ...driver.mjs` | override the port (default 3000); bash: `AGENCIAS_PORT=3100 node ...` |

The driver supplies its own port/Mongo/env — it ignores the real `.env`.

### Screenshot the Swagger UI (optional)

With the server running (`serve` mode), capture the live Swagger UI via the
project's `puppeteer`:

```powershell
node .claude\skills\run-agencias-api\screenshot.mjs http://127.0.0.1:3000/agencias/v1/api-docs swagger.png
```

Prints `{"title":"API Agencias - Swagger","tagCount":16,"out":"swagger.png"}`.

## Run (human path)

`npm run start` / `start:dev` boot the app against the **real** `.env`
(production Mongo + live integrations) and block the shell. A clean clone has
**no `.env`** (it is gitignored), so this fails at startup with a Joi
`Config validation error` until you provide one. Use the driver instead — it is
the only path that runs on a clean machine without secrets. Not re-verified here
to avoid connecting to production.

## Test

```powershell
npm run test:e2e
```

Result this session: **38 passed, 1 failed** (`mytool-reservas.e2e-spec.ts`
passes fully; the single failure is the stale boilerplate `app.e2e-spec.ts` —
see Gotchas). It spins up its own in-memory `MongoMemoryReplSet`; set the
version to the cached one to stay offline:

```powershell
$env:MONGOMS_VERSION="8.2.1"; npm run test:e2e
```

`npm test` (jest unit) reports **"No tests found, exiting with code 1"** — there
are no `*.spec.ts` files under `src/`. Don't use it as a health check.

## Gotchas

- **`.env` points at PRODUCTION Mongo + real API keys.** `MONGO_URL` in the
  committed dev `.env` is the production cluster, and `src/config/envs.ts`
  validates ~40 required vars at boot. The driver sidesteps this entirely:
  it injects dummy values for every required var and an in-memory Mongo URL,
  passed as the child process env. `dotenv` does **not** override already-set
  env vars, so the driver's values win and no real secret/DB is used.
- **`npm test` finds zero tests and exits 1.** Real coverage lives in
  `test/*.e2e-spec.ts` (run via `npm run test:e2e`), not `src/**/*.spec.ts`.
- **`app.e2e-spec.ts` is broken boilerplate.** It asserts `GET /` → 200
  `"Hello World!"`, but the app sets a global prefix `agencias/v1/` and has no
  root route, so it 404s. Expected failure; ignore it.
- **`POST /auth/sign-in` validates the password format before checking creds.**
  `SignInDto` requires upper+lower+digit (regex in `sing-in.dto.ts` — note the
  typo'd filename). A weak password returns 400, not 401. The driver uses
  `Wrongpass1` so it passes validation and actually reaches the auth/DB path.
- **Everything is served under `/agencias/v1/`.** There is no `/health`
  endpoint; the readiness probe and smoke checks hit
  `/agencias/v1/api-docs-json` (the OpenAPI JSON) instead.
- **mongodb-memory-server version pin.** The driver sets `MONGOMS_VERSION=8.2.1`
  to match the cached binary; without a cached match, the first run downloads
  it (needs network once).

## Troubleshooting

- **`[driver] Missing .../dist/main.js — Build first: npm run build`** — you
  skipped the build step. Run `npm run build`.
- **`[driver] startup failed: app process exited early` + Joi
  `Config validation error`** — a required env var is unset. The driver covers
  all of them; if you see this, a new `.required()` var was added to
  `src/config/envs.ts` — add a dummy for it in `driver.mjs` (`dummyEnv`).
- **`[driver] startup failed: server did not become ready` but the log says
  `Aplicación iniciada en puerto N`** — port `N` was already taken by another
  local service, so the smoke probe reached the wrong app (hit this with a
  pre-existing service squatting on `:4000`). Pick a free port:
  `$env:AGENCIAS_PORT=3100; node .claude\skills\run-agencias-api\driver.mjs`.
- **`serve` mode left a process on :3000.** Kill it (PowerShell):
  `Get-NetTCPConnection -LocalPort 3000 -State Listen | %{ taskkill /pid $_.OwningProcess /T /F }`
  and stop stray mongod: `Get-Process mongod-x64-win32-8.2.1 | Stop-Process -Force`.
- **First run hangs downloading mongod/Chromium** — no cached binary and no
  network. Run once on a connected machine to populate the caches.
