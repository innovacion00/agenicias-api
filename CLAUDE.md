# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`agencias-api` is a NestJS 10 + Mongoose REST API for a travel-agency back office:
reservas (hotel bookings), cotizaciones (quotes), vuelos (flights), eventos, and
agency/wallet management. Every route is served under the global prefix
**`agencias/v1/`**; Swagger UI lives at `agencias/v1/api-docs`. Code, comments,
and commit messages are predominantly in Spanish — match that when editing.

## Commands

```powershell
npm run start:dev        # watch mode (boots against the REAL .env — prod Mongo + live integrations)
npm run build            # nest build -> dist/main.js
npm run lint             # eslint --fix over {src,apps,libs,test}
npm run format           # prettier --write

npm run test:e2e         # the real test suite (test/*.e2e-spec.ts, in-memory Mongo replset)
npm test                 # jest unit — runs src/**/*.spec.ts (unit tests added in PR-2.x); the e2e suite is the primary gate
```

Run a single e2e test:
```powershell
$env:MONGOMS_VERSION="8.2.1"; npx jest --config ./test/jest-e2e.json test/mytool-reservas.e2e-spec.ts
```
Set `MONGOMS_VERSION` to the cached `mongodb-memory-server` binary version to stay offline.

### Running locally without secrets (preferred for agents)

A clean clone has **no `.env`** (gitignored), and `src/config/envs.ts` validates
~40 required vars via Joi at boot, so `npm run start` fails without one — and the
committed dev `.env` points at the **production** Mongo cluster and live API keys.
Use the **`run-agencias-api` skill / driver** instead: it boots an in-memory
MongoDB and injects dummy env vars, so it never touches prod or external services.

```powershell
npm run build
node .claude\skills\run-agencias-api\driver.mjs          # boot + smoke checks + teardown (exit 0/1)
node .claude\skills\run-agencias-api\driver.mjs serve    # stay up on :3000 for manual probing / Swagger
```

### Maintenance scripts

`scripts/*.ts` run via `ts-node` (see `package.json` scripts) — e.g.
`npm run seed:airports` populates the airport reference catalog,
`npm run sync:maarlab-keys` syncs per-agency MaarLab bearer keys.

## Architecture

### Module layout
Standard Nest feature modules under `src/<feature>/` (controller + service +
`entities/` Mongoose schemas + `dto/` + `interfaces/`). `AppModule` wires them
all plus global concerns: Pino structured logging (`nestjs-pino`), Mongoose
connection pool, and a global `ThrottlerGuard` (rate limits: 100/min, 500/10min,
2000/hr per IP). `ValidationPipe` is global with `whitelist` +
`forbidNonWhitelisted` + `transform` — DTOs strictly define accepted fields.

### Two parallel authentication schemes
1. **JWT for human users** (`AuthModule`, passport-jwt). Protect routes with
   `@Auth(...ValidRoles)` (`src/auth/decorators/auth/`). Roles:
   `admin`, `user`, `super-admin`, `eventos-super-admin` (`ValidRoles` enum).
   Access tokens expire in 60m; refresh tokens are persisted (`RefreshToken` entity).
   OTP verification flow exists (`OtpVerification` entity).
2. **API keys for machine integrations** (`IntegrationsModule`). Protect routes
   with `@ApiKeyProtected(...ValidIntegrationsRoles)`
   (`src/auth/decorators/integrations/`) — backed by `ApiKeyGuard` + the
   `Integration` entity.

When adding a protected endpoint, pick the right decorator family; they are not
interchangeable.

### External integrations (the core complexity)
This API is largely an orchestration layer over third-party services. Config and
constants for each live in `src/config/` (`envs.ts`, `constants/`):
- **Autocore** — agency wallet/cartera (saldo, recargas, payment links) and
  reservation backend. Has separate prod and `_DEV` credentials/URLs.
- **Cobre** — payment links / counterparties.
- **My Tool** — hotel booking engine. Per-hotel API keys (`API_<HOTEL>` env vars,
  resolved by hotel slug); see `src/reservas/services/my-tool-booking.service.ts`
  and `src/my-tool/`.
- **Amadeus** & **MaarLab** (OceanFlights) — flight search/booking (`VuelosModule`).
  MaarLab uses a **per-agency** bearer token: `Agencia.maarlabApiKey` (synced via
  the maarlab scripts). `MAARLAB_AUTH_TOKEN` is deprecated — do not use it for
  outbound auth.
- **Cloudinary** — file/image uploads (`FilesModule` + `CloudinaryModule`).
- **SendGrid / Nodemailer / Google Gmail API** — email (`SendEmailCustomService`).

Outbound HTTP to these services is centralized in
`src/common/services/http-custom.service.ts` (`HttpCustomService`, exported by the
global-ish `CommonModule`). Add new outbound calls there rather than scattering
axios usage.

### Reservas specifics
`ReservasModule` includes background services for cancellations:
`CancellationTasksQueueService` and `CancellationLockReconciliationService`
(distributed-lock reconciliation, driven by `@nestjs/schedule`). The My Tool
booking payload has subtle field routing — some fields go to My Tool, others are
DB-only (see the Swagger description in `src/main.ts` and `MyToolBookingService`).

### Config access
Never read `process.env` directly. Import the validated, typed `envs` object from
`src/config`; add new vars to **both** the `EnvVars` interface and the Joi schema
in `src/config/envs.ts`, then expose them on the exported `envs`. A missing
required var throws `Config validation error` at boot.

## Gotchas
- `test/app.e2e-spec.ts` is stale boilerplate (asserts `GET /` → "Hello World!"
  but the global prefix makes it 404). It fails by design — ignore it.
- `POST /auth/sign-in` validates password format (upper+lower+digit) **before**
  checking credentials, so a weak password returns 400, not 401. The DTO file is
  named `sing-in.dto.ts` (typo preserved).
- There is no `/health` route; readiness checks hit `agencias/v1/api-docs-json`.
