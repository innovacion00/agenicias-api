# Fase 4: Escalabilidad Horizontal — Plan de Diseno

## Estado actual

### Hallazgos criticos de exploradores

#### 1. Singletons en memoria (11 total)

| Componente | Severidad | Impacto | Ubicacion |
|---|---|---|---|
| **ThrottlerGuard** | CRITICA | Rate limit inconsistente entre replicas (cada una cuenta independientemente) | `src/main.ts` |
| **CancellationTasksQueueService** | ALTA | Job array en memoria + deduplicacion por replica (5s interval) | `src/reservas/services/cancellation-tasks-queue.service.ts` |
| **CancellationTasksQueue timer** | ALTA | `setInterval(5000)` ejecutado por cada replica | `src/reservas/services/cancellation-tasks-queue.service.ts` |
| **CancellationLockReconciliation** | ALTA | `setInterval(5min)` sin distributed lock, riesgo de race conditions | `src/reservas/services/cancellation-lock-reconciliation.service.ts` |
| **MyTool token cache** | MODERADA | Map local (50m TTL), cache fragmentado entre replicas | `src/reservas/services/my-tool-booking.service.ts` |
| **MyTool mappings cache** | MODERADA | Map local (5m TTL) | `src/reservas/services/my-tool-booking.service.ts` |
| **Flight city name cache** | MODERADA | Map sin limite de tamano, crecimiento indefinido | `src/vuelos/services/flight-city-name.service.ts` |
| **ReservasCountCache** | MODERADA | Map (1m TTL) | `src/reservas/services/count-cache.service.ts` |
| **SumaTotales cache** | MODERADA | Map local | `src/reservas/services/suma-totales.service.ts` |
| **Airport suggestion cache** | MODERADA | Map (45s TTL, max 150) | `src/airports/services/airport-suggestion.service.ts` |
| **Handlebars template cache** | BAJA | Map read-only (seguro) | `src/notificaciones/templates/render.helper.ts` |

#### 2. Crons no idempotentes (4 total)

| Tarea | Frecuencia | Servicio | Riesgos | Ubicacion |
|---|---|---|---|---|
| `cancelarReservasVencidasAutomatico` | EVERY_HOUR | NotificacionesService | NO IDEMPOTENTE: emails duplicados + llamadas Autocore duplicadas si cron restarts | `src/notificaciones/services/notificaciones.service.ts` |
| `ejecutarBotReservasPendientes` | EVERY_DAY_AT_8AM | ReservasService | IDEMPOTENTE (solo emails) | `src/reservas/services/reservas.service.ts` |
| `processDueJobs` | setInterval 5s | CancellationTasksQueueService | Deduplicacion solo por replica | `src/reservas/services/cancellation-tasks-queue.service.ts` |
| `reconcileStaleCancellationLocks` | setInterval 5min | CancellationLockReconciliation | SIN distributed lock, race conditions garantizadas | `src/reservas/services/cancellation-lock-reconciliation.service.ts` |

#### 3. Inventario de secretos (47 env vars)

- **22 secretos** (API keys, tokens, passwords): AUTOCORE, MAARLAB, AMADEUS, CLOUDINARY, SENDGRID, etc.
- **25 config** (URLs, flags, limits): todas en `src/config/envs.ts` con validacion Joi
- **Cero hardcoded secrets** en source code
- **No existe `.env.example`** — riesgo onboarding
- **MAARLAB_AUTH_TOKEN deprecado** pero aun en esquema Joi
- **13 vars `API_*`** son endpoints (config), no secretos
- **Per-agency MaarLab keys** en `Agencia.maarlabApiKey`
- **Dev/Prod Autocore split** via `*_DEV` vars

---

## Diseno propuesto por PR

### PR-4.1: Health checks + Shutdown Hooks

**Objetivo**: Implementar readiness/liveness checks con `@nestjs/terminus` y graceful shutdown.

**Problema**: No hay `/health` ni control sobre shutdown — rolling deploys pueden cortar conexiones activas.

**Cambios exactos**:

1. **Nuevo**: `src/health/health.controller.ts` — controller con endpoints `/health/live` y `/health/ready`
   - `/live`: ping a Mongo (`MongooseHealthIndicator`)
   - `/ready`: ping a Mongo + Redis (cuando exista) + verificacion de queue size

2. **Nuevo**: `src/health/health.module.ts` — modulo con `TerminusModule`

3. **Modificar**: `src/main.ts` — agregar graceful shutdown con `enableShutdownHooks()`
   - SIGTERM handler con timeout de 30s para drenar conexiones activas

4. **Modificar**: `src/app.module.ts` — importar `HealthModule`

5. **Actualizar**: `package.json` — agregar `@nestjs/terminus`

**Rutas expuestas**:
- `GET /agencias/v1/health/live` — liveness (Mongo ping)
- `GET /agencias/v1/health/ready` — readiness (Mongo + extras)

---

### PR-4.2: Redis para Throttler

**Objetivo**: Reemplazar in-memory ThrottlerGuard con storage Redis centralizado.

**Problema**: Cada replica cuenta rate limits independientemente → bypass de limites.

**Cambios exactos**:

1. **Nuevo**: `src/config/throttler.config.ts` — configuracion centralizada de throttlers con opcion Redis/memory
   - Tres niveles: 100/min, 500/10min, 2000/hora por IP
   - Fallback automatico a memory si Redis no disponible

2. **Nuevo**: `src/redis/redis.module.ts` — modulo global Redis con `createClient`
   - Reconnect strategy con backoff exponencial
   - Provider `REDIS_CLIENT` exportado globalmente

3. **Modificar**: `src/config/envs.ts` — agregar `REDIS_URL` (optional, default `redis://localhost:6379`)

4. **Modificar**: `src/app.module.ts` — importar RedisModule + ThrottlerModule con Redis storage

5. **Actualizar**: `package.json` — agregar `redis` + actualizar `@nestjs/throttler`

**Comportamiento**:
- Throttler counters centralizados en Redis con TTL
- Fallback a memory si Redis unavailable (log WARN)
- Rate limits globales respetados entre replicas

---

### PR-4.3: Redis para Contadores + Distributed Locks

**Objetivo**: Centralizar contadores en cache + agregar distributed locks para crons.

**Problema**:
- Contadores (`ReservasCountCache`, `SumaTotales`) fragmentados entre replicas
- Crons criticos sin atomicidad ni proteccion contra ejecucion concurrente

**Cambios exactos**:

1. **Nuevo**: `src/common/services/distributed-lock.service.ts`
   - `acquireLock(key, ttlMs, maxRetries)` — SET NX con token unico
   - `releaseLock(key, token)` — solo libera si el token coincide
   - `tryLock(key, fn, ttlMs)` — wrapper que adquiere, ejecuta y libera

2. **Nuevo**: `src/common/services/redis-cache.service.ts`
   - `get/set/del` con prefijo `cache:` y TTL configurable
   - `increment/decrement` para contadores atomicos

3. **Modificar**: `src/common/common.module.ts` — exportar nuevos servicios

4. **Modificar**: `src/reservas/services/cancellation-lock-reconciliation.service.ts`
   - Wrappear `reconcileStaleCancellationLocks` con `tryLock`
   - Solo una replica ejecuta simultaneamente

5. **Modificar**: `src/notificaciones/services/notificaciones.service.ts`
   - `cancelarReservasVencidasAutomatico` con distributed lock + tracking de last-run

6. **Reemplazar**: `src/reservas/services/count-cache.service.ts` — backend Redis

7. **Modificar**: `src/reservas/services/my-tool-booking.service.ts` — token cache a Redis

**Garantias**:
- Distributed locks con timeout + token-based release (previene zombie locks)
- Crons idempotentes via last-run tracking + locks
- Contadores centralizados con TTL

---

### PR-4.4: `.env.example` + Separacion Secrets vs Config

**Objetivo**: Crear `.env.example` + documentar que es secret vs config.

**Problema**: No hay `.env.example` → developers no saben que vars necesitan.

**Cambios exactos**:

1. **Nuevo**: `.env.example` — todas las ~47 variables con secciones documentadas
   - Cada seccion separada: JWT, Database, Cache, Autocore, MyTool, Amadeus, MaarLab, Cobre, Cloudinary, Email, App Config
   - Comentarios indicando SECRET vs CONFIG por variable

2. **Modificar**: `src/config/envs.ts` — agregar comentarios JSDoc indicando SECRET vs CONFIG por variable

3. **Nuevo**: `docs/env-guide.md` — guia de clasificacion de variables y flujo de onboarding

---

### PR-4.5: Worker Process (Crons aisladas)

**Objetivo**: Mover crons de API a worker independiente.

**Problema**: Crons ejecutadas por cada replica API → duplicacion incluso con locks.

**Cambios exactos**:

1. **Nuevo**: `src/main-worker.ts` — entry point del worker (sin HTTP listener)

2. **Nuevo**: `src/worker/worker.module.ts` — importa solo modulos necesarios para crons:
   - MongooseModule, ScheduleModule, RedisModule
   - ReservasModule, NotificacionesModule

3. **Nuevo**: `src/reservas/services/worker-cron.service.ts` — crons de reservas con distributed lock

4. **Nuevo**: `src/notificaciones/services/worker-cron.service.ts` — cron de cancelacion con lock + idempotencia

5. **Modificar**: `src/app.module.ts` — REMOVER ScheduleModule (crons ya no corren en API)

6. **Actualizar**: `package.json` — agregar script `start:worker`

7. **Actualizar**: `nest-cli.json` — configurar build para main-worker

8. **Nuevo**: `Dockerfile.worker` — imagen para deploy del worker

**Topologia**:
- API: N replicas `node dist/main.js` (sin crons)
- Worker: 1 replica `node dist/main-worker.js` (todas las crons, con locks por si escala)

---

### PR-4.6: Secret Manager Integration

**Objetivo**: Integrar gestor de secretos para inyectar secrets en prod sin `.env`.

**Problema**: En prod, secrets en archivo plano. Sin rotacion automatica ni auditoria.

**Cambios exactos**:

1. **Nuevo**: `scripts/doppler-sync.ts` — sincronizar secrets desde Doppler a `.env.local` (solo dev)

2. **Nuevo**: `scripts/aws-ssm-sync.ts` — alternativa para AWS Secrets Manager

3. **Modificar**: `src/main.ts` — cargar secrets desde AWS antes de bootstrap si `NODE_ENV=production`

4. **Nuevo**: `docs/secret-manager-setup.md` — guia de setup Doppler/AWS + rotacion

5. **Actualizar**: `package.json` — scripts `secrets:sync`, `secrets:list`

**Flujo**:
1. **Dev**: `doppler-sync.ts` → `.env.local` → AppModule
2. **Prod**: Secret manager → env vars auto-inyectadas → AppModule (sin `.env` en disco)

---

### PR-4.7: Observabilidad (Prometheus + CorrelationId)

**Objetivo**: Exponer metricas Prometheus + propagar correlation ID en headers outbound.

**Problema**: Sin observabilidad, imposible debuggear performance/errores en prod.

**Cambios exactos**:

1. **Nuevo**: `src/observability/prometheus.module.ts` — registro de metricas con `@willsoto/nestjs-prometheus`
   - Metricas default con prefijo `agencias_`
   - Endpoint `/agencias/v1/metrics`

2. **Nuevo**: `src/observability/correlation-id.middleware.ts` — middleware que lee/genera `x-correlation-id`
   - Almacena en CLS (context-local storage) via `nestjs-cls`
   - Propaga a response headers

3. **Modificar**: `src/common/services/http-custom.service.ts` — interceptor outbound con correlation ID
   - Agrega `x-correlation-id` a todas las llamadas HTTP salientes
   - Log de respuestas con correlationId

4. **Nuevo**: `src/common/services/metrics.service.ts` — metricas custom (reservas creadas/canceladas, latencia outbound)

5. **Modificar**: `src/app.module.ts` — importar ObservabilityModule + ClsModule

6. **Nuevo**: `docs/observability-setup.md` — guia de Prometheus scrape + alertas recomendadas

7. **Actualizar**: `package.json` — agregar `@willsoto/nestjs-prometheus`, `prom-client`, `nestjs-cls`, `uuid`

**Rutas expuestas**:
- `GET /agencias/v1/metrics` — metricas Prometheus

---

### PR-4.8: Native API Versioning

**Objetivo**: Implementar versionado de API nativo NestJS.

**Problema**: Global prefix `agencias/v1` es hardcodeado. Preparar infraestructura para v2.

**Cambios exactos**:

1. **Nuevo**: `src/common/decorators/api-version.decorator.ts` — decorador `@ApiVersion(...versions)`

2. **Nuevo**: `src/common/middleware/api-version.middleware.ts` — resuelve version desde header o URL path

3. **Modificar**: `src/main.ts` — `app.enableVersioning(VersioningType.URI)`

4. **Nuevo**: `docs/api-versioning.md` — guia de uso del versionado

**Nota**: Esta PR solo prepara la infraestructura. Los controllers existentes siguen funcionando como v1 sin cambios.

---

## Matriz PR x Archivos

| Archivo | 4.1 | 4.2 | 4.3 | 4.4 | 4.5 | 4.6 | 4.7 | 4.8 |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|
| **Existentes** |
| `src/app.module.ts` | M | M | M | - | M | - | M | - |
| `src/main.ts` | M | - | - | - | M | M | M | M |
| `src/config/envs.ts` | - | M | M | M | - | - | - | - |
| `src/common/services/http-custom.service.ts` | - | - | - | - | - | - | M | - |
| `src/common/common.module.ts` | - | - | M | - | - | - | - | - |
| `src/reservas/services/my-tool-booking.service.ts` | - | - | M | - | - | - | - | - |
| `src/reservas/services/count-cache.service.ts` | - | - | M | - | - | - | - | - |
| `src/reservas/services/cancellation-lock-reconciliation.service.ts` | - | - | M | - | - | - | - | - |
| `src/notificaciones/services/notificaciones.service.ts` | - | - | M | - | - | - | - | - |
| `package.json` | M | M | - | - | M | M | M | - |
| `nest-cli.json` | - | - | - | - | M | - | - | - |
| **Nuevos** |
| `src/health/*` | C | - | - | - | - | - | - | - |
| `src/redis/redis.module.ts` | - | C | - | - | - | - | - | - |
| `src/config/throttler.config.ts` | - | C | - | - | - | - | - | - |
| `src/common/services/distributed-lock.service.ts` | - | - | C | - | - | - | - | - |
| `src/common/services/redis-cache.service.ts` | - | - | C | - | - | - | - | - |
| `src/common/services/metrics.service.ts` | - | - | - | - | - | - | C | - |
| `src/observability/*` | - | - | - | - | - | - | C | - |
| `src/worker/*` | - | - | - | - | C | - | - | - |
| `src/main-worker.ts` | - | - | - | - | C | - | - | - |
| `src/common/decorators/api-version.decorator.ts` | - | - | - | - | - | - | - | C |
| `src/common/middleware/api-version.middleware.ts` | - | - | - | - | - | - | - | C |
| `.env.example` | - | - | - | C | - | - | - | - |
| `scripts/doppler-sync.ts` | - | - | - | - | - | C | - | - |
| `scripts/aws-ssm-sync.ts` | - | - | - | - | - | C | - | - |
| `docs/*` | C | - | - | C | - | C | C | C |
| `Dockerfile.worker` | - | - | - | - | C | - | - | - |

**Leyenda**: C = crear, M = modificar

---

## Orden de ejecucion y dependencias

### Fase A: Sin dependencias (paralelas)

| PR | Dependencias | Duracion est. | Riesgo |
|---|---|---|---|
| **PR-4.1: Health checks** | Ninguna | 1 dia | Bajo |
| **PR-4.4: .env.example** | Ninguna | 1 dia | Bajo |
| **PR-4.7: Observabilidad** | Ninguna | 2 dias | Bajo |
| **PR-4.8: API versioning** | Ninguna | 1 dia | Bajo |

### Fase B: Cache + Locks (secuencial)

| PR | Dependencias | Duracion est. | Riesgo |
|---|---|---|---|
| **PR-4.2: Redis Throttler** | Ninguna (prereq para 4.3) | 2 dias | MEDIO |
| **PR-4.3: Redis Counters+Locks** | PR-4.2 (RedisModule) | 3 dias | ALTO |

### Fase C: Aislamiento de Crons

| PR | Dependencias | Duracion est. | Riesgo |
|---|---|---|---|
| **PR-4.5: Worker Process** | PR-4.3 (distributed-lock) | 3 dias | CRITICO |

### Fase D: Secrets (post-config)

| PR | Dependencias | Duracion est. | Riesgo |
|---|---|---|---|
| **PR-4.6: Secret Manager** | PR-4.4 (envs.ts documentado) | 2 dias | ALTO |

### Diagrama de dependencias

```
PR-4.1 (health)    ──┐
PR-4.4 (.env.example)─┼─→ [Fase A: Paralela]
PR-4.7 (observabilidad)┤
PR-4.8 (versioning) ──┘

PR-4.4 ──→ PR-4.6 (Secret Manager)

PR-4.2 (Redis) ──→ PR-4.3 (Locks) ──→ PR-4.5 (Worker)
```

---

## Riesgos y plan de rollback por PR

### PR-4.1: Health Checks
- **Riesgo**: Bajo. Graceful shutdown timeout podria ser insuficiente.
- **Mitigacion**: Timeout configurable. Health check con timeout corto (3-5s).
- **Rollback**: `git revert` — sin impacto funcional.

### PR-4.2: Redis Throttler
- **Riesgo**: MEDIO. Redis unavailable → fallback a memory (pierde garantias globales).
- **Mitigacion**: Fallback configurable. Si `REDIS_URL` ausente, usar memory + log WARN.
- **Rollback**: `git revert` — vuelve a memory throttler.

### PR-4.3: Redis Counters + Locks
- **Riesgo**: ALTO. Lock timeout insuficiente → cron en paralelo. Deadlock si doReconciliation() tarda mas del TTL.
- **Mitigacion**: Lock TTL = max(duracion_esperada) + 25% buffer. Testear bajo carga.
- **Rollback**: `git revert` — vuelve a memory caches, contadores se resetean.

### PR-4.4: .env.example
- **Riesgo**: Bajo (documentacion pura).
- **Rollback**: `git revert` — sin impacto.

### PR-4.5: Worker Process
- **Riesgo**: CRITICO. Si worker falla, CERO crons ejecutan. Duplicacion temporal durante deploy si API + Worker corren simultaneamente.
- **Mitigacion**: Worker con `livenessProbe`. Flag `ENABLE_CRONS` para rollback rapido.
- **Rollback**: Reactivar `ScheduleModule` en API.

### PR-4.6: Secret Manager
- **Riesgo**: ALTO. Si secret manager unreachable en prod, app no bootea.
- **Mitigacion**: SLA 99.99%. Pre-test con mock secrets localmente.
- **Rollback**: Restaurar `.env` + `git revert`.

### PR-4.7: Observabilidad
- **Riesgo**: Bajo (aditivo).
- **Mitigacion**: Testear async context con CLS.
- **Rollback**: `git revert` — sin impacto funcional.

### PR-4.8: API Versioning
- **Riesgo**: Bajo (infraestructura, sin cambios de rutas).
- **Rollback**: `git revert` — sin impacto.

---

## KPIs con linea base -> meta

### Escalabilidad

| KPI | Linea base | Meta | Metodo |
|---|---|---|---|
| Rate limit consistency entre replicas | +-20% variance | < 1% variance | requests/min por IP, 3 replicas |
| Cron duplicates con 2 replicas | 2x (duplicado) | 1x exacto | log del lock distribuido |
| Cache hit rate (counts) | ~30% (in-memory, reset por deploy) | > 70% (Redis, persistente) | redis HITS / GETS |

### Confiabilidad

| KPI | Linea base | Meta | Metodo |
|---|---|---|---|
| Graceful shutdown time | N/A | < 30s drain | time desde SIGTERM a exit |
| Health check latency | N/A | < 100ms (live), < 1s (ready) | `time curl /health/*` |
| Distributed lock timeouts | N/A | 0 per week | monitoreo `lock:*` keys |

### Observabilidad

| KPI | Linea base | Meta | Metodo |
|---|---|---|---|
| Correlation ID propagation | 0% | 100% (outbound APIs) | grep headers HTTP |
| Prometheus scrape success | N/A | > 99% | prometheus up metric |

### Seguridad

| KPI | Linea base | Meta | Metodo |
|---|---|---|---|
| Secretos de prod en disco | ~30 en `.env` | 0 (inyeccion runtime) | auditoria post PR-4.6 |
| Tiempo de rotar un secreto | horas-dias | < 15 min | central + redeploy |
