# Plan de Mejora — agencias-api

> Revisión extensa del codebase (junio 2026). Objetivo: llevar la API a nivel
> profesional — alto rendimiento, buenas prácticas, fácil de escalar y optimizar.
>
> Alcance revisado: 252 archivos TS, ~26.400 líneas, 17 módulos de feature.
>
> **Las fases 2, 3 y 4 tienen plan de implementación detallado (KPIs, sub-agentes,
> gates de aprobación y gestión de secretos extendida) en
> [PLAN_IMPLEMENTACION.md](./PLAN_IMPLEMENTACION.md).**

---

## Resumen ejecutivo

El proyecto tiene una base sólida (NestJS 10, validación global con DTOs,
logging estructurado con Pino, rate limiting, doble esquema de auth), pero
presenta debilidades concentradas en cinco frentes:

1. **Seguridad**: CORS abierto con credenciales, refresh tokens en texto plano,
  inyección de regex en búsquedas, sin headers de seguridad (helmet).
2. **Arquitectura**: servicios "Dios" (`reservas.service.ts` con ~3.150 líneas),
  `HttpCustomService` acoplado a features, lógica duplicada en ~5 métodos de
   búsqueda casi idénticos.
3. **Rendimiento**: Puppeteer lanzado por request, queries `all=true` sin límite
  con `populate`, búsquedas por `$regex 'i'` sin índice utilizable.
4. **Escalabilidad horizontal**: caché y rate-limit en memoria del proceso,
  crons dentro del mismo proceso API — todo se rompe o duplica con ≥2 instancias.
5. **Calidad/Operación**: 0 tests unitarios, sin CI/CD, sin Dockerfile, 91 usos
  de `: any`, manejo de errores que descarta el error real ("Revisar logs").

El plan está organizado en 5 fases ordenadas por riesgo/beneficio. Las fases 0 y 1
son baratas y de alto impacto; las fases 2–4 son inversión estructural.

---

## Hallazgos detallados

### A. Seguridad (prioridad crítica)


| #   | Hallazgo                                                                                         | Evidencia                                                                                                                                                    | Riesgo                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | CORS refleja cualquier origen **con credenciales** (`origin: true` + `credentials: true`)        | `src/main.ts:19-23`                                                                                                                                          | Cualquier sitio web puede hacer requests autenticados con las cookies/credenciales del usuario (CSRF-like). Los navegadores lo permiten porque el servidor refleja el `Origin`.                                                               |
| A2  | Refresh tokens persistidos **en texto plano**                                                    | `src/auth/entities/refresh-token.entity.ts:13-17`                                                                                                            | Un dump de la BD (o acceso de lectura) permite suplantar sesiones de cualquier usuario. Deben guardarse hasheados (SHA-256 basta; son aleatorios).                                                                                            |
| A3  | **Inyección de regex / ReDoS** en búsquedas: input del usuario va directo a `$regex` sin escapar | `src/agencias/agencias.service.ts:220-225`, `src/reservas/reservas.service.ts` (`buscarPorNombreAgente`, `buscarPorNombreAgencia`, `buscarPorNombreHuesped`) | Un payload tipo `(a+)+$` puede colgar el query/CPU de Mongo; también permite ampliar resultados con metacaracteres. Ya existe `escapeRegex()` en `referencia-aeropuertos.service.ts:7` — solo hay que centralizarlo y usarlo en todas partes. |
| A4  | Sin `helmet` ni headers de seguridad; Swagger UI expuesto sin autenticación                      | `src/main.ts` (no hay `app.use(helmet())`)                                                                                                                   | Falta `X-Content-Type-Options`, `Strict-Transport-Security`, etc. Swagger en prod revela toda la superficie de la API.                                                                                                                        |
| A5  | `bcrypt.hashSync` / `compareSync` **síncronos** en el flujo de login                             | `src/auth/auth.service.ts:342,405,454,793`                                                                                                                   | Cada login bloquea el event loop ~100ms (factor 10). Bajo carga concurrente degrada TODA la API. Usar las versiones async.                                                                                                                    |
| A6  | Rate limiting en memoria (Throttler por defecto)                                                 | `src/app.module.ts:96-112`                                                                                                                                   | Con N instancias el límite real es N×. Necesita storage compartido (Redis) para ser efectivo al escalar.                                                                                                                                      |
| A7  | `.env` de desarrollo apunta a **Mongo de producción** y llaves vivas                             | Documentado en CLAUDE.md                                                                                                                                     | Riesgo operacional permanente: un `npm run start:dev` descuidado toca datos reales. Crear un `.env.development` con recursos aislados y secretos por gestor (Doppler/Vault/SSM).                                                              |
| A8  | Sin índice TTL para refresh tokens expirados                                                     | `refresh-token.entity.ts:44` (índice normal sobre `expiresAt`)                                                                                               | La colección crece sin límite. `expireAfterSeconds: 0` sobre `expiresAt` los purga solos.                                                                                                                                                     |


### B. Arquitectura y diseño


| #   | Hallazgo                                                                                                                                                                                                                                                  | Evidencia                                          | Costo                                                                                                                                                                                                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | **Servicio Dios**: `reservas.service.ts` = 99 KB / ~3.150 líneas / ~30 métodos públicos que mezclan booking, pagos, cancelaciones, búsquedas y notificaciones                                                                                             | `src/reservas/reservas.service.ts`                 | Imposible de testear o razonar; cada cambio arriesga regresiones en flujos no relacionados.                                                                                                                                     |
| B2  | **Duplicación masiva**: `buscarPorChatbotId`, `buscarPorNombreAgente`, `buscarPorNombreAgencia`, `buscarPorNombreHuesped`, `buscarPorEstado` repiten ~130 líneas del mismo patrón (filtro por rol → suma de totales → rama `all` → paginación → populate) | `reservas.service.ts:1198-1724`                    | 5 copias que divergen; ya tienen tipos de retorno inline duplicados. Un solo `buscarReservas(criterio)` parametrizado las reemplaza.                                                                                            |
| B3  | `HttpCustomService` (21 KB) es otro servicio Dios: concentra Cobre + Autocore + lógica de cancelación, e **importa interfaces de `reservas`** (módulo común dependiendo de un feature — dependencia invertida)                                            | `src/common/services/http-custom.service.ts:18-38` | El "común" conoce los features. Debe partirse en clientes por proveedor (`AutocoreClient`, `CobreClient`) con sus propias interfaces.                                                                                           |
| B4  | `ErrorManager` descarta el error real y responde `"Revisar logs"` sin ID de correlación; el parámetro `context` del constructor no se usa                                                                                                                 | `src/common/helpers/hendler-error.helper.ts:12,32` | Debugging en prod a ciegas: el cliente no puede reportar nada útil y el log no se puede correlacionar con la respuesta. Además el catch-all por método (`try/catch` + `errorManager.handle`) repite boilerplate en cada método. |
| B5  | No hay **ExceptionFilter global** — solo `vuelos` tiene uno (`src/vuelos/filters/error-handler.filter.ts`); el formato de error es inconsistente entre módulos                                                                                            | `src/app.module.ts` (sin `APP_FILTER`)             | Cada módulo inventa su forma de error. Un filtro global + formato estándar (código, mensaje, correlationId) elimina los try/catch repetidos.                                                                                    |
| B6  | Plantillas de email como **44 KB de HTML inline en constantes TS**                                                                                                                                                                                        | `src/config/constants/emailPlantillas.ts`          | Inmantenible, sin preview, mezcla presentación con código. Mover a templates (Handlebars/MJML) en `templates/`.                                                                                                                 |
| B7  | Typos institucionalizados en nombres: `sing-in.dto.ts`, `hendler-error.helper.ts`, `notificaiconReservaGrupo`, `ICreateAgenciaResponce`                                                                                                                   | varios                                             | Fricción diaria y mala señal de calidad. Renombrar con un codemod en una PR dedicada.                                                                                                                                           |
| B8  | Sin versionado nativo de API (prefijo `agencias/v1/` hardcodeado como string)                                                                                                                                                                             | `src/main.ts:17`                                   | Cuando exista v2 no habrá mecanismo. `app.enableVersioning(VersioningType.URI)` lo resuelve.                                                                                                                                    |


### C. Rendimiento


| #   | Hallazgo                                                                                      | Evidencia                                                | Costo                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | **Puppeteer se lanza por cada PDF** (browser completo por request, sin cola ni reutilización) | `src/cotizaciones/cotizaciones.service.ts:426-457`       | 1–3 s y cientos de MB de RAM por request; dos requests simultáneos pueden tumbar un contenedor pequeño. Si el upload a Cloudinary falla después de `browser.close()`, bien; pero si `page.pdf()` lanza, el browser **queda huérfano** (no hay `try/finally`). |
| C2  | `all=true` retorna **todas** las reservas sin límite, con doble `populate`                    | `reservas.service.ts:1303-1321` (y en cada `buscarPor`*) | Con decenas de miles de reservas: OOM del proceso y transferencia gigante. Reemplazar por export en streaming (cursor) o paginación obligatoria con límite alto.                                                                                              |
| C3  | Búsquedas con `$regex` insensible y no anclado no pueden usar índices                         | `buscarPorNombre*`, `agencias.service.ts:220`            | Collection scan en cada búsqueda. Usar índice de texto de Mongo, campos normalizados (`nombreLower`) con prefijo anclado, o Atlas Search.                                                                                                                     |
| C4  | Caché de counts en `Map` en memoria con TTL, key = `JSON.stringify(filter)`                   | `reservas.service.ts:70-142`                             | No se invalida al crear/cancelar reservas (totales desfasados), no se comparte entre instancias, y `JSON.stringify` de filtros con ObjectId produce keys frágiles.                                                                                            |
| C5  | `bcrypt` síncrono en login (ver A5) — también es problema de rendimiento                      | `auth.service.ts`                                        | Bloqueo del event loop bajo carga.                                                                                                                                                                                                                            |
| C6  | `maxPoolSize: 10` puede quedarse corto con los crons + colas de cancelación + tráfico         | `src/app.module.ts:85`                                   | Esperas de checkout de conexión bajo picos. Medir y subir (30–50 es razonable).                                                                                                                                                                               |


### D. Escalabilidad horizontal


| #   | Hallazgo                                                                               | Evidencia                                                               | Costo                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Crons corren **dentro del proceso API** (`@Cron` en bot-reservas y notificaciones)     | `bot-reservas-pendientes.service.ts:67`, `notificaciones.service.ts:67` | Con 2+ instancias, cada cron corre N veces (emails duplicados al cliente). El módulo de cancelaciones ya tiene lock distribuido — generalizar ese patrón o extraer workers. |
| D2  | Estado en memoria del proceso: throttler (A6) + countCache (C4) + colas de cancelación | varios                                                                  | La app **no es stateless**; escalar horizontal hoy produce comportamiento incorrecto, no solo subóptimo.                                                                    |
| D3  | Sin `app.enableShutdownHooks()`                                                        | `src/main.ts`                                                           | En deploys/restarts, crons y tareas en vuelo se cortan a mitad (reservas a medio cancelar).                                                                                 |
| D4  | Sin endpoint `/health` (readiness usa `api-docs-json`, que construye el doc Swagger)   | CLAUDE.md, `src/main.ts`                                                | Los orquestadores necesitan liveness/readiness baratos que verifiquen Mongo. `@nestjs/terminus` lo da en 20 líneas.                                                         |


### E. Calidad, tipado y testing


| #   | Hallazgo                                                                                                                                                       | Evidencia                                                                                                      | Costo                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| E1  | **0 tests unitarios** (`npm test` no encuentra nada); 1 e2e real (`mytool-reservas`) + 1 e2e roto por diseño (`app.e2e-spec.ts`)                               | `test/`                                                                                                        | Flujos de dinero (pagos, cancelaciones, billetera) sin red de seguridad.                                                        |
| E2  | **Sin CI/CD, sin Dockerfile, sin hooks de pre-commit**                                                                                                         | no existe `.github/`, `Dockerfile`, `.husky/`                                                                  | Nada impide mergear código que no compila o no pasa lint. Deploy no reproducible.                                               |
| E3  | 91 usos de `: any` en 19 archivos; `tsconfig` sin `strict: true` (faltan `strictFunctionTypes`, `strictPropertyInitialization`, `noUncheckedIndexedAccess`...) | `tsconfig.json:15-25`                                                                                          | Los `any` se concentran justo en los servicios críticos (`booking-personas` 22, `reservas` 16, `vuelos` 16).                    |
| E4  | 12 `console.log/error` en `reservas` en lugar del Logger de Pino                                                                                               | `reservas.controller.ts`, `reservas.service.ts`                                                                | Logs fuera del flujo estructurado: sin nivel, sin contexto, invisibles para agregadores.                                        |
| E5  | `process.env` directo en 3 sitios pese a la regla del proyecto                                                                                                 | `cotizaciones.service.ts:427` (`CHROMIUM_PATH`), `vuelos/config/maarlab-webhook.config.ts`, `app.module.ts:36` | `CHROMIUM_PATH` ni siquiera está en el esquema Joi: en Windows/dev el fallback `/usr/bin/chromium-browser` revienta en runtime. |
| E6  | Validación de formato de password **antes** de verificar credenciales en sign-in (400 en vez de 401)                                                           | `auth.service.ts` + `sing-in.dto.ts`                                                                           | Filtra información sobre la política de passwords y confunde a los clientes del API.                                            |


---

## Plan de ejecución por fases

### Fase 0 — Seguridad crítica (1–2 días, sin refactors)

Cambios pequeños, de bajo riesgo, que cierran los huecos más graves:

1. **CORS**: lista blanca de orígenes vía env (`ALLOWED_ORIGINS` en `envs.ts`).
  ```ts
   app.enableCors({ origin: envs.allowedOrigins, credentials: true, ... });
  ```
2. **Helmet**: `npm i helmet` + `app.use(helmet())` en `main.ts`. Proteger
  Swagger detrás de auth básica o desactivarlo en prod (`NODE_ENV`).
3. **Escapar regex**: mover `escapeRegex()` de `referencia-aeropuertos.service.ts`
  a `src/common/helpers/escape-regex.helper.ts` y aplicarlo en **todos** los
   `$regex` que reciben input del usuario (`agencias`, `reservas`, etc.).
4. **Hashear refresh tokens**: guardar `sha256(token)` en BD, comparar el hash al
  refrescar. Agregar índice TTL: `RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })`.
5. **bcrypt async**: reemplazar `hashSync/compareSync` por `hash/compare` (await).
6. `**enableShutdownHooks()`** en `main.ts`.
7. `**CHROMIUM_PATH**` al esquema Joi + `envs` (opcional con default documentado).

*Criterio de aceptación*: e2e verde, ningún `$regex` con input crudo
(`grep -n '\$regex' src` revisado a mano), login funciona, CORS rechaza orígenes
no listados.

### Fase 1 — Red de seguridad: tooling, CI y tipado (3–5 días)

El objetivo es que ningún refactor posterior se haga sin red:

1. **CI (GitHub Actions)**: workflow con `npm ci` → `lint` → `build` →
  `test:e2e` (con `MONGOMS_VERSION` cacheado). Bloquear merge si falla.
2. **Dockerfile multi-stage** (build → runtime con `dist/` + prod deps) y
  `.dockerignore`. Considerar imagen con Chromium o separar el PDF (ver Fase 3).
3. **Husky + lint-staged**: `eslint --fix` + `prettier` en pre-commit.
4. **Borrar `test/app.e2e-spec.ts*`* (roto por diseño) y crear smoke e2e que
  levante la app y verifique `GET /health` (ver Fase 4) y `api-docs-json`.
5. **Tests unitarios de los flujos de dinero primero**: `AuthService` (sign-in,
  refresh, OTP), cálculo de pagos/cancelaciones de `reservas`
   (`debeBloquearCancelacionPorPrimeraMitadPagada` y helpers puros), y
   `MyToolBookingService` (ruteo de campos My Tool vs BD, que CLAUDE.md marca
   como sutil). Meta inicial realista: cubrir helpers puros y servicios con
   mocks de modelos; no perseguir % global.
6. **Endurecer tsconfig por etapas**: activar `strict: true` y compensar con
  los flags ya laxos; prohibir `any` nuevo con
   `@typescript-eslint/no-explicit-any: error` y reducir los 91 existentes al
   tocar cada archivo (regla de boy-scout, no big-bang).
7. **Reemplazar `console.*` por el Logger** de Nest/Pino (12 casos en reservas).

*Criterio de aceptación*: PR no mergeable sin CI verde; `docker build && docker run`
levanta la API; primeros ~30 tests unitarios sobre lógica de dinero.

### Fase 2 — Arquitectura: desarmar los servicios Dios (1–2 semanas, incremental)

Orden recomendado (cada paso es una PR independiente con e2e verde):

1. **Unificar las búsquedas de reservas** (B2): un solo
  `ReservasSearchService.buscar(criterio: CriterioBusquedaReserva)` que recibe
   `{ tipo: 'agente'|'agencia'|'huesped'|'estado'|'chatbotId', valor, page, all }`
   y centraliza filtro-por-rol, paginación, populate y suma de totales. Los 5
   métodos actuales quedan como wrappers finos y luego se eliminan del controller.
   **Esto solo elimina ~500 líneas duplicadas.**
2. **Partir `ReservasService` por dominio**:
  - `ReservasBookingService` (crear/editar, Autocore + My Tool),
  - `ReservasPagosService` (links de pago, billetera, estados de pago),
  - `ReservasCancelacionService` (ya existen las colas — mover ahí la lógica),
  - `ReservasSearchService` (punto 1).
   El service actual queda como fachada hasta migrar el controller.
3. **Partir `HttpCustomService`** (B3) en `AutocoreClient` y `CobreClient` bajo
  `src/common/clients/` (o módulos `autocore/`/`cobre/`), cada uno con sus
   interfaces. Las interfaces de reservas vuelven a `reservas/`. Mantener el
   patrón actual: TODO outbound HTTP pasa por estos clientes.
4. **Manejo de errores global** (B4/B5): `APP_FILTER` global con formato estándar
  `{ statusCode, message, correlationId, timestamp }` usando el `req.id` de
   Pino como correlationId; el filtro loguea el error completo. Después,
   **eliminar los try/catch + `errorManager.handle` repetidos** método por
   método (el filtro ya cubre el caso). Renombrar/eliminar
   `hendler-error.helper.ts`.
5. **Plantillas de email** (B6): mover `emailPlantillas.ts` (44 KB) a archivos
  `.hbs` en `src/notificaciones/templates/` renderizados con Handlebars.
6. **Renombrar typos** (B7) en una PR mecánica: `sing-in.dto.ts → sign-in.dto.ts`,
  `hendler-error → handler-error`, `notificaiconReservaGrupo → notificacionReservaGrupo`,
   `ICreateAgenciaResponce → ICreateAgenciaResponse`.

*Criterio de aceptación*: `reservas.service.ts` < 500 líneas (fachada o
eliminado), ningún archivo de servicio > 800 líneas, `common/` no importa nada
de `src/<feature>/`.

### Fase 3 — Rendimiento (1 semana)

1. **PDF (C1)**:
  - Corto plazo: envolver el flujo Puppeteer en `try/finally { browser.close() }`
   y serializar la generación con un semáforo simple (1–2 PDFs concurrentes).
  - Mediano plazo: reutilizar una instancia de browser (`puppeteer.connect`/pool)
  o extraer la generación a un worker/servicio aparte (el API encola, el
  worker genera y sube a Cloudinary). Eso también saca Chromium de la imagen
  del API.
2. **Eliminar `all=true` sin límite (C2)**: si el caso de uso es exportar,
  implementar export con cursor en streaming (CSV/Excel con `exceljs` que ya
   está en deps) y deprecar `all=true`; si es UI, imponer `limit` máximo (p. ej. 500).
3. **Índices para búsquedas (C3)**: agregar campos normalizados
  (`fullNameLower`, etc.) con índice y buscar por prefijo anclado
   (`^${escaped}`), o índice de texto de Mongo. Auditar con `explain()` las 5
   queries de búsqueda más usadas. Documentar los índices en cada entity (hoy
   solo 5 de ~15 entidades tienen índices).
4. **Caché de counts (C4)**: invalidar al crear/cancelar reserva, o sustituir por
  `estimatedDocumentCount`/counts aproximados para listados. Si se adopta Redis
   (Fase 4), moverlo ahí.
5. **Pool de Mongo (C6)**: instrumentar (Atlas metrics / `connectionPoolCreated`
  events) y ajustar `maxPoolSize` según p95 de checkout.

*Criterio de aceptación*: generación de PDF no puede tumbar el proceso (probar 5
concurrentes), ninguna query de listado sin `limit`, `explain()` muestra IXSCAN
en las búsquedas principales.

### Fase 4 — Escalabilidad horizontal y operación (1–2 semanas)

1. **Redis como infraestructura compartida**:
  - `ThrottlerStorageRedis` para rate limiting real entre instancias (D2/A6),
  - caché de counts (C4),
  - locks distribuidos genéricos (generalizar el patrón de
  `CancellationLockReconciliationService`).
2. **Separar workers de la API** (D1): los `@Cron` de bot-reservas y
  notificaciones se mueven a un proceso worker (mismo repo, segundo
   entrypoint `main-worker.ts` con un `WorkerModule` que importa solo lo
   necesario). La API queda stateless y escalable; el worker corre con 1 réplica
   o con locks.
3. **Health checks** (D4): `@nestjs/terminus` con `/agencias/v1/health`
  (liveness) y `/agencias/v1/health/ready` (ping a Mongo). Actualizar el driver
   del skill `run-agencias-api` y los checks de despliegue.
4. **Observabilidad**:
  - propagar `correlationId` (req.id de Pino) a los logs de llamadas salientes
   en los clientes HTTP,
  - métricas básicas (`prom-client` o el módulo de OpenTelemetry de Nest):
  latencia por ruta, errores 5xx, duración de llamadas a Autocore/My Tool/
  Amadeus/MaarLab, tamaño de colas de cancelación,
  - alertas sobre fallos de crons (hoy un cron que muere a las 8 AM no lo nota
  nadie hasta que un cliente reclama).
5. **Gestión de secretos** (A7): sacar los secretos del `.env` plano hacia un
  gestor (Doppler/Vault/AWS SSM) e inyectarlos en runtime; crear `.env.example`
   versionado con TODOS los nombres de variables (sin valores) — hoy un dev
   nuevo no puede saber qué necesita sin leer `envs.ts`.
6. **Versionado de API** (B8): `app.enableVersioning(VersioningType.URI)` con
  `defaultVersion: '1'`, prefijo `agencias`. Permite introducir `v2` por
   endpoint sin big-bang.

*Criterio de aceptación*: 2 réplicas de la API detrás de un LB se comportan
idéntico a 1 (rate limit, counts, ningún email duplicado); dashboard con latencia
y errores por integración externa.

---

## Quick wins (se pueden hacer hoy, < 1 hora cada uno)

- [ ] `app.use(helmet())` y `enableShutdownHooks()` en `main.ts`.
- [ ] Lista blanca de CORS por env.
- [ ] `escapeRegex()` centralizado y aplicado a todos los `$regex`.
- [ ] Índice TTL en `RefreshToken.expiresAt`.
- [ ] `bcrypt` async en `auth.service.ts`.
- [ ] Borrar `test/app.e2e-spec.ts`.
- [ ] Reemplazar los 12 `console.`* de reservas por Logger.
- [ ] `CHROMIUM_PATH` al esquema Joi/`envs`.
- [ ] `try/finally` alrededor de Puppeteer en `generatePdf`.
- [ ] Crear `.env.example` con todas las variables (sin valores).

## Métricas de éxito del plan completo


| Métrica                             | Hoy           | Meta                                       |
| ----------------------------------- | ------------- | ------------------------------------------ |
| Archivo de servicio más grande      | ~3.150 líneas | < 800 líneas                               |
| Usos de `: any` en `src/`           | 91            | < 20 (y prohibido en código nuevo)         |
| Tests unitarios                     | 0             | Flujos de dinero y helpers puros cubiertos |
| CI                                  | inexistente   | lint + build + e2e bloqueando merge        |
| Instancias soportadas correctamente | 1             | N (stateless + Redis + workers)            |
| `$regex` con input sin escapar      | ~8 sitios     | 0                                          |
| Tokens de sesión en claro en BD     | sí            | hasheados + TTL                            |


## Riesgos y mitigaciones

- **Refactor de `reservas` sin tests**: por eso la Fase 1 (tests de flujos de
dinero) va ANTES de la Fase 2. No desarmar el servicio Dios sin esa red.
- `**.env` de dev apunta a prod**: cualquier trabajo de las fases 2–3 debe
ejecutarse con el driver `run-agencias-api` (Mongo en memoria) — nunca
`start:dev` contra el `.env` real.
- **Cambio de CORS puede romper frontends existentes**: levantar la lista de
orígenes reales con el equipo de frontend antes de desplegar la Fase 0.
- **Mover crons a worker cambia el deployment**: coordinar con quien opere la
infraestructura; el paso intermedio (locks distribuidos con Redis) permite
escalar sin cambiar la topología.

