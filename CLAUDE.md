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

npm run test:e2e         # integration suite (test/*.e2e-spec.ts, in-memory Mongo replset)
npm test                 # jest unit — only 3 specs exist, all under src/reservas/
```

Run a single test:
```powershell
# e2e (set MONGOMS_VERSION to the cached mongodb-memory-server binary to stay offline)
$env:MONGOMS_VERSION="8.2.1"; npx jest --config ./test/jest-e2e.json test/mytool-reservas.e2e-spec.ts

# unit (root jest config in package.json: rootDir=src, testRegex=*.spec.ts)
npx jest src/reservas/utils/checkin-reserva.utils.spec.ts
```

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
**These connect to whatever `MONGO_URL` the local `.env` points at (production).**

## Architecture

### Module layout
Standard Nest feature modules under `src/<feature>/` (controller + service +
`entities/` Mongoose schemas + `dto/` + `interfaces/`). `AppModule` wires them
all plus global concerns: Pino structured logging (`nestjs-pino`), Mongoose
connection pool, and a global `ThrottlerGuard` (rate limits: 100/min, 500/10min,
2000/hr per IP). `ValidationPipe` is global with `whitelist` +
`forbidNonWhitelisted` + `transform` — DTOs strictly define accepted fields, and
an unknown body key is a 400, not a silent drop.

Business logic lives in fat services (`reservas.service.ts` is ~3.7k lines);
controllers are thin. Cross-cutting behaviour is factored into `services/`,
`utils/`, `pipes/` and `decorators/` subfolders inside each feature.

### Three parallel authentication schemes
1. **JWT for human users** (`AuthModule`, passport-jwt). Protect routes with
   `@Auth(...ValidRoles)` (`src/auth/decorators/auth/`); read the user with
   `@GetUser()`. Roles: `admin`, `user`, `super-admin`, `eventos-super-admin`
   (`ValidRoles` enum). Access tokens expire in 60m; refresh tokens are persisted
   (`RefreshToken` entity). OTP verification flow exists (`OtpVerification` entity).
2. **API keys for machine integrations** (`IntegrationsModule`). Protect routes
   with `@ApiKeyProtected(...ValidIntegrationsRoles)`
   (`src/auth/decorators/integrations/`) — backed by `ApiKeyGuard` + the
   `Integration` entity. Roles are `autocore-prod` / `autocore-dev`.
3. **One shared static token** — `@StaticTokenAuth()`
   (`src/auth/decorators/static-token-auth.decorator.ts`) compares the
   `x-booking-token` header (or a `Bearer` fallback) against
   `envs.bookingPersonasToken`. Used only by `BookingPersonasModule`.

When adding a protected endpoint, pick the right decorator family; they are not
interchangeable.

### Multi-tenancy / row-level scoping
Data is tenant-scoped by `agenciaId`, enforced **in service code**, not by a
guard. The canonical shape is `ReservasService.construirFiltroPorRol()`:
`super-admin` → no filter (sees everything), `admin` → `{ agenciaId }`,
`user` → `{ userId }`. Ad-hoc `!user.role.includes('super-admin')` checks guard
mutations throughout the same file. Any new list/read/mutate path must apply an
equivalent filter or it leaks across agencies.

### External integrations (the core complexity)
This API is largely an orchestration layer over third-party services. Config and
constants for each live in `src/config/` (`envs.ts`, `constants/`):
- **Autocore** — agency wallet/cartera (saldo, recargas, payment links) and
  reservation backend. Has separate prod and `_DEV` credentials/URLs. Inbound
  webhooks land in `ReservasModule` (`AutocoreWebhookEvent` entity +
  `payment-webhook-reconciliation.service.ts` for replay/idempotency).
- **Cobre** — payment links / counterparties.
- **My Tool** — hotel booking engine. Per-hotel API keys (`API_<HOTEL>` env vars,
  resolved by hotel slug); see `src/reservas/services/my-tool-booking.service.ts`
  and `src/my-tool/`.
- **Amadeus** & **MaarLab** (OceanFlights) — flight search/booking (`VuelosModule`,
  plus `MaarlabCredentialsModule`). MaarLab uses a **per-agency** bearer token:
  `Agencia.maarlabApiKey` (synced via the maarlab scripts). `MAARLAB_AUTH_TOKEN`
  is deprecated — do not use it for outbound auth. See
  `src/vuelos/ERROR_HANDLING_SYSTEM.md` for that module's error taxonomy.
- **Cloudinary** — file/image uploads (`FilesModule` + `CloudinaryModule`).
- **SendGrid / Nodemailer / Google Gmail API** — email (`SendEmailCustomService`).

Outbound HTTP to these services is centralized in
`src/common/services/http-custom.service.ts` (`HttpCustomService`, exported by the
global-ish `CommonModule`). Add new outbound calls there rather than scattering
axios usage.

### Background work (`@nestjs/schedule`)
- `BotReservasPendientesModule` — daily 08:00 cron chasing pending reservations.
- `NotificacionesModule` — hourly cron.
- `ReservasModule` — `CancellationTasksQueueService` and
  `CancellationLockReconciliationService` (distributed-lock reconciliation).

**`ScheduleModule.forRoot()` is registered exactly once, inside
`bot-reservas-pendientes.module.ts`** — it is what enables crons app-wide.
Removing that import silently kills every scheduled job in the app.

### Reservas specifics
The My Tool booking payload has subtle field routing — some fields go to My Tool,
others are DB-only (see the Swagger description in `src/main.ts` and
`MyToolBookingService`). Booking state transitions are guarded by check-in date
(`checkin-reserva.utils.ts`), and payment state lives in `ValidPaymentStatus`.

### Config access
Never read `process.env` directly. Import the validated, typed `envs` object from
`src/config`; add new vars to **both** the `EnvVars` interface and the Joi schema
in `src/config/envs.ts`, then expose them on the exported `envs`. A missing
required var throws `Config validation error` at boot.

### Conventions
- Imports use the absolute `src/...` form (`tsconfig` `baseUrl: "./"`), not deep
  relative paths, for anything outside the current feature folder.
- `strictNullChecks` and `noImplicitAny` are **on**; `strictPropertyInitialization`
  is off (Mongoose `@Prop()` fields rely on that).
- Service catch blocks funnel through `ErrorManager.handle()`
  (`src/common/helpers/hendler-error.helper.ts` — typo in filename preserved). It
  rethrows known Nest HTTP exceptions, maps Mongo duplicate-key `11000` to a 400,
  and turns everything else into a 500 "Revisar logs". So an unexpected failure
  surfaces as an opaque 500 — check the Pino logs, not the response body.

### Testing patterns
E2E specs do **not** boot `AppModule`. Each builds a narrow `Test.createTestingModule`
with just the controller/service under test, wires `MongooseModule.forRoot()` to a
`MongoMemoryReplSet` (replset is required — the code uses transactions), overrides
`AuthGuard`/`UserRoleGuard` with a fake user carrying a fixed `agenciaId`, and
supplies mock providers for `HttpCustomService` and `SendEmailCustomService` so no
external call escapes. Follow that shape for new suites.

## Documentation in-repo
`docs/` holds Spanish integration manuals (`MANUAL_INTEGRACION_*.md`,
`RESUMEN_BASE_DE_DATOS.md`) and there are more `*.md` reports at the repo root.
They are useful for integration semantics but are point-in-time — verify against
code before relying on them.

## Gotchas
- `README.md` is untouched NestJS starter boilerplate; it says nothing about this
  project. Don't cite it.
- `test/app.e2e-spec.ts` is stale boilerplate (asserts `GET /` → "Hello World!"
  but the global prefix makes it 404). It fails by design — ignore it.
- `POST /auth/sign-in` validates password format (upper+lower+digit) **before**
  checking credentials, so a weak password returns 400, not 401. The DTO file is
  named `sing-in.dto.ts` (typo preserved).
- There is no `/health` route; readiness checks hit `agencias/v1/api-docs-json`.
