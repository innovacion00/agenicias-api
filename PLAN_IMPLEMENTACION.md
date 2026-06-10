# Plan de Implementación — Fases 2, 3 y 4

> Complemento ejecutable de [PLAN_DE_MEJORA.md](./PLAN_DE_MEJORA.md).
> Alcance: **Fase 2** (desarmar servicios Dios), **Fase 3** (rendimiento),
> **Fase 4** (escalabilidad horizontal), con explicación extendida de
> **gestión de secretos**.
>
> Reglas del plan:
> 1. **Ninguna fase se ejecuta sin su sub-plan aprobado** (etapa P de cada fase).
> 2. **El trabajo se orquesta con sub-agentes especializados** desde el inicio,
>    con tareas paralelas donde no hay dependencias.
> 3. Toda verificación local usa el driver `run-agencias-api` (Mongo en memoria),
>    **nunca** `start:dev` contra el `.env` real (apunta a producción).

---

## 0. Metodología de trabajo

### 0.1 Ciclo por fase: Planificar → Aprobar → Ejecutar → Verificar

Cada fase y cada mejora dentro de la fase sigue el mismo ciclo obligatorio:

```
┌─────────────┐   ┌──────────┐   ┌────────────┐   ┌─────────────┐
│ P. Sub-plan │ → │ G. Gate  │ → │ E. Ejecutar│ → │ V. Verificar│
│ (análisis + │   │ (humano  │   │ (PRs       │   │ (KPIs +     │
│  diseño)    │   │  aprueba)│   │  atómicas) │   │  e2e verde) │
└─────────────┘   └──────────┘   └────────────┘   └─────────────┘
```

- **P (Sub-plan)**: antes de tocar código, se produce un documento corto
  (`docs/planes/fase-X-<mejora>.md`) con: inventario exacto de archivos
  afectados, diseño propuesto, orden de PRs, riesgos y plan de rollback.
  Lo generan los sub-agentes de exploración/planificación (ver 0.2).
- **G (Gate)**: el sub-plan se presenta para aprobación humana. No se ejecuta
  nada de esa mejora hasta el visto bueno. Esto aplica a CADA mejora, no solo
  a la fase.
- **E (Ejecutar)**: PRs pequeñas e independientes; cada una compila, pasa lint
  y e2e. Una PR = una mejora o un paso de una mejora. Nunca mezclar refactor
  con cambio de comportamiento en la misma PR.
- **V (Verificar)**: se miden los KPIs de la mejora (tablas más abajo) y se
  registran en el sub-plan como evidencia de cierre.

### 0.2 Orquestación con sub-agentes especializados

El flujo usa sub-agentes con roles fijos. Los roles de análisis pueden correr
**en paralelo**; los de implementación corren en paralelo solo cuando tocan
archivos disjuntos (aislados por worktree).

| Rol | Tipo de agente | Responsabilidad | Paralelizable |
|-----|----------------|-----------------|---------------|
| **Explorador** | `Explore` (solo lectura) | Inventario: callers, dependencias, usos reales de un símbolo antes de moverlo | Sí — varios a la vez por área |
| **Arquitecto** | `Plan` | Redactar el sub-plan de la mejora (diseño, orden de PRs, riesgos) a partir de los inventarios | Sí — uno por mejora |
| **Implementador** | `general-purpose` + worktree | Ejecutar UNA PR del sub-plan aprobado en un worktree aislado | Sí — si las PRs no comparten archivos |
| **Verificador** | `general-purpose` | Correr build + lint + e2e + driver de smoke contra la rama del implementador; medir KPIs | Sí — uno por PR terminada |
| **Revisor** | `claude` (code-review) | Revisión de la PR antes del merge (correctness + el checklist de la fase) | Sí |

**Patrón de ejecución por mejora:**

```
            ┌→ Explorador A (callers de X)      ┐
Mejora N ───┼→ Explorador B (entidades/índices) ┼→ Arquitecto → GATE →
            └→ Explorador C (tests existentes)  ┘
                                                      ┌→ Implementador PR-1 → Verificador → Revisor → merge
→ (tras aprobación) ─────────────────────────────────┼→ Implementador PR-2 → Verificador → Revisor → merge
                                                      └→ Implementador PR-3 → ...
```

**Reglas de los sub-agentes:**
- Implementadores siempre en **worktree aislado** (`isolation: worktree`) para
  no pisarse entre sí ni ensuciar `main`.
- Dos implementadores nunca trabajan a la vez sobre `reservas.service.ts` u
  otro archivo compartido; el Arquitecto define la matriz de archivos por PR
  en el sub-plan justamente para detectar colisiones.
- El Verificador es siempre un agente distinto del Implementador (no se
  auto-verifica).
- Resultado de cada agente se registra en el sub-plan (link a rama/PR, salida
  de KPIs).

### 0.3 Prerrequisito innegociable

La **Fase 1 del plan general (tests de flujos de dinero + CI)** debe estar
hecha antes de iniciar la Fase 2. Desarmar `reservas.service.ts` sin tests de
pagos/cancelaciones es apostar dinero real a que el refactor es perfecto.
Si la Fase 1 no está completa, la primera tanda de sub-agentes de la Fase 2
se dedica a cerrarla (los tests unitarios de helpers de dinero se
paralelizan muy bien: un implementador por servicio).

---

## 1. FASE 2 — Desarmar los servicios Dios

**Objetivo:** ningún servicio > 800 líneas; cero duplicación en búsquedas;
`common/` sin dependencias hacia features; errores con formato único y
correlation ID.

### 1.1 Etapa P — Sub-planes previos (1–2 días, todo en paralelo)

| Sub-agente | Tarea | Entregable |
|------------|-------|------------|
| Explorador 1 | Mapear los ~30 métodos públicos de `reservas.service.ts`: quién los llama (controller, crons, otros módulos), qué modelos tocan, qué notificaciones disparan | `docs/planes/fase2-inventario-reservas.md` |
| Explorador 2 | Mapear consumidores de `HttpCustomService` método por método y qué interfaces de `reservas/interface` usa cada uno | `docs/planes/fase2-inventario-http.md` |
| Explorador 3 | Diff semántico de los 5 `buscarPor*`: qué tienen EXACTAMENTE distinto (filtros, populate, meta) — las divergencias son los casos de prueba | `docs/planes/fase2-diff-busquedas.md` |
| Explorador 4 | Inventario de try/catch + `errorManager.handle` por módulo y de respuestas de error actuales (formato real que ven los clientes) | `docs/planes/fase2-inventario-errores.md` |
| Arquitecto | Con los 4 inventarios: diseño final de servicios, firma de `CriterioBusquedaReserva`, contrato del filtro global de errores, matriz PR×archivos | `docs/planes/fase2-diseno.md` → **GATE** |

### 1.2 Etapa E — PRs en orden (con paralelización)

```
PR-2.1 (búsquedas)──────┐
PR-2.2 (clientes HTTP)──┼─ paralelas (archivos disjuntos)
PR-2.3 (filtro errores)─┘
        ↓ (merge de 2.1 y 2.3)
PR-2.4 (partir ReservasService — booking)
PR-2.5 (partir ReservasService — pagos)      ← secuenciales entre sí
PR-2.6 (partir ReservasService — cancelación)
        ↓
PR-2.7 (plantillas email) ── paralela con 2.4–2.6
PR-2.8 (typos/renames) ── al final, mecánica
```

| PR | Contenido | Implementador trabaja en | Test que protege |
|----|-----------|--------------------------|------------------|
| 2.1 | `ReservasSearchService.buscar(criterio)` unificado; los 5 métodos quedan como wrappers de una línea | `src/reservas/services/` (archivo nuevo) | Tests unitarios nuevos: 1 caso por tipo de búsqueda × rol (user/admin/super-admin), comparando contra el comportamiento documentado en el diff del Explorador 3 |
| 2.2 | `AutocoreClient` + `CobreClient` en módulos propios; interfaces de reservas vuelven a `reservas/`; `HttpCustomService` queda como fachada deprecada | `src/autocore/`, `src/cobre/` (nuevos) | e2e mytool-reservas + smoke del driver |
| 2.3 | `GlobalExceptionFilter` (`APP_FILTER`): formato `{ statusCode, message, correlationId, timestamp, path }` con `req.id` de Pino; convive con el filtro de vuelos hasta absorberlo | `src/common/filters/` | Test e2e de formato de error (404, 400 validación, 500) |
| 2.4 | `ReservasBookingService` (crear/editar, Autocore + My Tool); `ReservasService` delega | `src/reservas/services/` | Tests de dinero de Fase 1 + e2e |
| 2.5 | `ReservasPagosService` (links, billetera, estados de pago) | ídem | ídem |
| 2.6 | `ReservasCancelacionService` (mover lógica junto a las colas existentes); eliminar try/catch redundantes ya cubiertos por 2.3 | ídem | ídem |
| 2.7 | Plantillas a `.hbs` + render con Handlebars; snapshot tests del HTML generado | `src/notificaciones/templates/` | Snapshot por plantilla |
| 2.8 | Renames: `sing-in.dto.ts`, `hendler-error`, `notificaiconReservaGrupo`, `ICreateAgenciaResponce` | global, mecánica | build + lint + e2e |

Cada PR: Implementador (worktree) → Verificador (build+lint+e2e+driver) →
Revisor → merge. Las tres primeras pueden tener sus tres pipelines corriendo
simultáneamente.

### 1.3 KPIs Fase 2

| KPI | Línea base (hoy) | Meta | Cómo se mide |
|-----|------------------|------|--------------|
| Líneas de `reservas.service.ts` | ~3.150 | < 400 (fachada) o 0 | `(Get-Content src/reservas/reservas.service.ts \| Measure-Object -Line).Lines` |
| Servicio más grande del repo | 99 KB | < 800 líneas | script en CI que falla si se supera |
| Métodos `buscarPor*` duplicados | 5 (~650 líneas) | 1 motor + wrappers de ≤5 líneas | revisión de PR-2.1 |
| Imports de `common/` hacia features | ≥1 (`reservas/interface`) | 0 | regla ESLint `import/no-restricted-paths` en CI |
| Módulos con formato de error propio | ≥2 | 1 formato global | e2e de formato de error |
| Errores 500 sin correlationId | 100 % | 0 % | test e2e + inspección de logs |
| try/catch boilerplate con `errorManager.handle` | ~1 por método | solo donde hay manejo real | grep contado en CI (tendencia ↓) |
| Regresiones funcionales | — | 0 e2e rotos en todo el proceso | CI por PR |

### 1.4 Riesgos específicos

- **Divergencias ocultas entre los 5 `buscarPor*`**: por eso el Explorador 3
  documenta el diff ANTES de unificar; cada divergencia se vuelve un test.
- **Consumidores externos del formato de error actual** (frontend, bots):
  el sub-plan de PR-2.3 debe listar los campos que hoy consume el frontend y
  mantenerlos; cambio coordinado.
- **PRs 2.4–2.6 tocan el mismo controller**: son secuenciales por diseño; no
  asignar dos implementadores a la vez.

---

## 2. FASE 3 — Rendimiento

**Objetivo:** ninguna operación puede tumbar el proceso (PDF, exports);
búsquedas con índice (IXSCAN); counts coherentes.

### 2.1 Etapa P — Sub-planes previos (1 día, paralelo)

| Sub-agente | Tarea | Entregable |
|------------|-------|------------|
| Explorador 1 | Censo de queries: todos los `find/aggregate` de listados, cuáles tienen `limit`, cuáles usan `$regex`, qué índices existen por entidad | `docs/planes/fase3-censo-queries.md` |
| Explorador 2 | Uso real de `all=true`: qué endpoints lo exponen y quién los consume (¿UI? ¿export? ¿bot?) | `docs/planes/fase3-uso-all.md` |
| Explorador 3 | Flujo completo de PDF: dónde se llama `generatePdf`, concurrencia esperada, tamaño de los HTML | `docs/planes/fase3-flujo-pdf.md` |
| Arquitecto | Diseño: estrategia de índices por colección (con `explain()` previsto), decisión export-streaming vs límite duro, diseño del pool/semáforo de Puppeteer | `docs/planes/fase3-diseno.md` → **GATE** |

> **Medición de línea base obligatoria antes del gate**: el Verificador corre
> contra el driver (datos sintéticos: ~50k reservas seed) y registra p95 de las
> 5 búsquedas principales, RAM de un PDF, RAM de `all=true`. Sin línea base no
> hay KPI honesto.

### 2.2 Etapa E — PRs

```
PR-3.1 (PDF try/finally + semáforo)──┐
PR-3.2 (límite duro / export stream)─┼─ paralelas
PR-3.3 (índices + prefijo anclado)───┘
        ↓
PR-3.4 (caché de counts con invalidación)
PR-3.5 (pool Mongo según métricas)
```

| PR | Contenido | Detalle |
|----|-----------|---------|
| 3.1 | `try/finally { await browser.close() }`; semáforo de concurrencia 2; instancia de browser reutilizada con relanzamiento ante crash | Si la Fase 4 trae worker, esto migra allí; el semáforo es el seguro inmediato |
| 3.2 | `all=true` → deprecado: export CSV/Excel por cursor en streaming (`exceljs` ya está en deps) con `limit` máximo configurable (default 500) para UI | Mantener `all=true` un release con warning de deprecación en la respuesta `meta` |
| 3.3 | Campos normalizados (`fullNameLower`, `hotelLower`…) con índice; búsquedas por prefijo anclado `^${escapeRegex(q)}`; script de migración para poblar los campos en documentos existentes | Migración con `bulkWrite` por lotes de 1.000; índices creados con `background: true` |
| 3.4 | Invalidar `countCache` en create/cancel/update de reserva; key estable (hash de filtro canónico, no `JSON.stringify` crudo) | Si Fase 4 adopta Redis, mover allí (la interfaz del caché se diseña ya abstracta: `ICountCache`) |
| 3.5 | Subir `maxPoolSize` según p95 de checkout medido (objetivo inicial 30) + eventos de pool instrumentados en logs | Cambio de 1 línea pero va al final porque depende de medición |

### 2.3 KPIs Fase 3

| KPI | Línea base | Meta | Cómo se mide |
|-----|-----------|------|--------------|
| p95 búsqueda por nombre (50k reservas seed) | medir en P | **−70 %** vs línea base | benchmark del Verificador contra driver, antes/después |
| Plan de ejecución de las 5 búsquedas top | COLLSCAN | IXSCAN en todas | `explain('executionStats')` documentado en el sub-plan |
| RAM pico al generar 5 PDFs concurrentes | medir en P (hoy: riesgo OOM) | proceso estable, < 1.5 GB pico, 0 browsers huérfanos | prueba de carga del Verificador + `Get-Process chrome*` tras la prueba |
| Browsers Chromium huérfanos tras fallo de PDF | sí (sin try/finally) | 0 | test que fuerza excepción en `page.pdf()` |
| Queries de listado sin `limit` | ≥5 (`all=true`) | 0 | grep + revisión del censo en CI |
| Desfase de counts tras crear/cancelar reserva | hasta TTL del caché (stale) | 0 (invalidación) o ≤ TTL documentado | test unitario de invalidación |
| Tiempo de export de 50k reservas | hoy: OOM probable | completa en streaming sin superar +200 MB RAM | benchmark del Verificador |

### 2.4 Riesgos específicos

- **Migración de campos normalizados sobre datos de producción**: script
  idempotente, por lotes, probado primero contra el driver con seed; ventana
  de mantenimiento NO necesaria (es aditivo) pero sí monitoreo del lag.
- **Cambiar `$regex 'i'` no anclado por prefijo anclado cambia resultados**
  (antes encontraba substrings en medio del texto): decisión de producto que
  el Arquitecto debe dejar explícita en el gate — alternativa: índice de
  texto de Mongo o mantener substring solo para super-admin.

---

## 3. FASE 4 — Escalabilidad horizontal y operación

**Objetivo:** 2+ réplicas detrás de un load balancer se comportan exactamente
igual que 1: rate limit global, counts coherentes, cero crons duplicados,
shutdown limpio y health checks reales.

### 3.1 Etapa P — Sub-planes previos (1–2 días, paralelo)

| Sub-agente | Tarea | Entregable |
|------------|-------|------------|
| Explorador 1 | Inventario de TODO el estado en memoria del proceso: throttler, countCache, colas de cancelación, locks existentes (`CancellationLockReconciliationService`), timers | `docs/planes/fase4-estado-memoria.md` |
| Explorador 2 | Mapa de los crons: qué hacen, qué pasa si corren 2 veces (¿idempotentes?), qué módulos necesitarían en un proceso worker | `docs/planes/fase4-mapa-crons.md` |
| Explorador 3 | Inventario completo de secretos: las ~40 vars de `envs.ts`, cuáles son secretos vs config, quién las consume, cuáles tienen versión `_DEV` | `docs/planes/fase4-inventario-secretos.md` |
| Arquitecto | Decisiones: proveedor Redis, topología API/worker, gestor de secretos elegido (ver §4), plan de migración sin downtime | `docs/planes/fase4-diseno.md` → **GATE** |

### 3.2 Etapa E — PRs

```
PR-4.1 (health checks + shutdown hooks)──── primera, desbloquea deploys seguros
PR-4.2 (Redis: throttler)──────┐
PR-4.3 (Redis: counts + locks)─┼─ paralelas tras decidir proveedor
PR-4.4 (.env.example + envs por capas)─┘
        ↓
PR-4.5 (worker process: main-worker.ts + crons migrados)
PR-4.6 (gestor de secretos en runtime)        ← ver sección 4
PR-4.7 (observabilidad: métricas + correlationId saliente)
PR-4.8 (versionado de API nativo)
```

| PR | Contenido | Detalle |
|----|-----------|---------|
| 4.1 | `@nestjs/terminus`: `GET /agencias/v1/health` (liveness barato) y `/health/ready` (ping Mongo + Redis cuando exista); `enableShutdownHooks()`; actualizar driver del skill y checks de deploy | 20–40 líneas; sin dependencias de las demás |
| 4.2 | `ThrottlerStorageRedis`; fallback a memoria si `REDIS_URL` ausente (para dev/driver) | Config nueva `REDIS_URL` vía `envs.ts` |
| 4.3 | `ICountCache` (de PR-3.4) implementado sobre Redis; `DistributedLockService` genérico extraído del patrón de cancelaciones, sobre Redis (`SET NX PX`) o Mongo TTL como fallback | Los crons lo usarán en 4.5 |
| 4.4 | `.env.example` versionado con TODAS las variables; separar en `envs.ts` lo que es **secreto** (keys, passwords) de lo que es **config** (URLs, flags) — preparación para 4.6 | Documentar cada var con un comentario de una línea |
| 4.5 | `src/main-worker.ts` + `WorkerModule` (schedule + bot-reservas + notificaciones + sus deps mínimas); quitar `ScheduleModule`/crons del proceso API; el worker toma locks de 4.3 por si corre con >1 réplica | Cambio de topología: coordinar deploy (1 réplica worker) |
| 4.6 | Integración del gestor de secretos elegido (ver §4): secretos inyectados en runtime, `.env` local solo para dev con valores dummy | Plan detallado en §4.4 |
| 4.7 | Métricas Prometheus (`prom-client`): latencia por ruta, 5xx, duración y errores por integración externa (Autocore/MyTool/Amadeus/MaarLab/Cobre), profundidad de colas; correlationId propagado en headers salientes y logueado | Endpoint `/metrics` protegido o en puerto interno |
| 4.8 | `app.enableVersioning(VersioningType.URI)` con `defaultVersion: '1'` manteniendo las URLs actuales byte a byte | Verificar con snapshot del `api-docs-json` antes/después |

### 3.3 KPIs Fase 4

| KPI | Línea base | Meta | Cómo se mide |
|-----|-----------|------|--------------|
| Réplicas soportadas con comportamiento correcto | 1 | N (probado con 2) | prueba: 2 instancias + LB local; rate limit global se respeta; 0 emails duplicados en una corrida de cron |
| Ejecuciones duplicadas de cron con 2 réplicas | 2× (duplicado) | 1× exacto | log del lock distribuido durante la prueba |
| Tiempo de respuesta de `/health` | n/a (no existe) | < 50 ms p99 | benchmark |
| Deploy con cero requests cortados a mitad | no garantizado | drain limpio (shutdown hooks + LB) | prueba de rolling restart con carga |
| Estado en memoria del proceso API | 3 sistemas (throttler, cache, colas) | 0 (todo en Redis/Mongo) | inventario del Explorador 1 re-auditado |
| Visibilidad de fallos de integraciones externas | solo logs sueltos | dashboard con tasa de error y p95 por proveedor | Grafana/equivalente sobre `/metrics` |
| Secretos en texto plano en disco del servidor | todos (~30) | 0 (inyección runtime) | auditoría post PR-4.6 |
| Cron caído sin que nadie lo note | indefinido | alerta < 15 min | heartbeat por cron + alerta |

### 3.4 Riesgos específicos

- **Redis se vuelve dependencia dura**: todo con fallback degradado (memoria)
  y el driver de dev no exige Redis. `health/ready` sí lo reporta.
- **Worker separado cambia la topología de deploy**: PR-4.5 va después de que
  4.1–4.3 estén en producción estables; rollback = reactivar `ScheduleModule`
  en la API (flag de entorno `ENABLE_CRONS`).
- **Idempotencia de crons**: si el Explorador 2 encuentra crons no idempotentes
  (emails), se arreglan ANTES de migrar (marca de "ya enviado" en BD).

---

## 4. Gestión de secretos — explicación extendida

### 4.1 El problema actual, en detalle

Hoy el proyecto maneja ~40 variables en un único `.env` plano, y de ellas unas
30 son **secretos vivos de producción**: `JWT_SECRET`, credenciales de Cobre,
Autocore (prod y dev), 13 API keys de hoteles My Tool, Amadeus, SendGrid,
Gmail (client secret + refresh token), Cloudinary, y la URL de Mongo con
credenciales embebidas. Esto tiene cinco problemas concretos:

1. **El blast radius es total.** Quien obtiene el archivo (laptop robada,
   backup, copy-paste a un chat, un `cat .env` en una screen-share) obtiene
   TODO: el dinero (Cobre/Autocore), la identidad (JWT_SECRET firma cualquier
   token válido), el correo corporativo (Gmail refresh token) y la base de
   datos completa.
2. **No hay rotación posible en la práctica.** Rotar `JWT_SECRET` o una key de
   hotel exige editar el archivo en cada máquina/servidor a mano y reiniciar.
   Como es doloroso, no se hace, y los secretos tienen años. Un secreto que no
   se puede rotar en minutos es un secreto que ya hay que asumir filtrado.
3. **No hay auditoría.** Es imposible saber quién leyó un secreto, cuándo y
   desde dónde. Si mañana aparece un cargo raro en Cobre, no hay forma de
   rastrear si la credencial se filtró ni desde cuándo.
4. **Dev y prod comparten secretos.** El `.env` de desarrollo apunta al Mongo
   de producción y usa las keys vivas. Cada desarrollador (y cada agente de IA
   que corra en esta máquina) opera con poderes de producción. Un
   `start:dev` descuidado escribe en datos reales.
5. **El onboarding es tribal.** No existe `.env.example`; un dev nuevo no
   puede saber qué variables necesita sin leer `envs.ts`, y conseguir los
   valores implica que alguien le pase el `.env` completo por un canal
   inseguro (otra copia más en circulación).

### 4.2 Cómo funciona la solución (conceptos)

Un **gestor de secretos** es un servicio que almacena los secretos cifrados y
los entrega a la aplicación **en runtime**, autenticando QUIÉN los pide:

```
ANTES:  .env en disco ──> dotenv ──> process.env ──> envs.ts
AHORA:  Gestor (cifrado, versionado, auditado)
              │  (la app/CI se autentica con UNA credencial de máquina)
              ▼
        inyección en runtime ──> process.env ──> envs.ts  (sin cambios abajo)
```

Piezas clave:

- **Inyección en runtime**: el proceso recibe los secretos como variables de
  entorno al arrancar (`doppler run -- node dist/main.js` o un init-container
  que las trae de SSM). El disco del servidor **nunca** tiene un `.env` de
  producción. `envs.ts` y todo el código aguas abajo **no cambian**.
- **Una credencial por entorno/servicio**, no treinta: la máquina de prod
  tiene un solo token de servicio cuyo único poder es "leer los secretos del
  entorno prod". Se revoca en un clic si se compromete.
- **Versionado y rotación**: cambiar un secreto es una operación central; los
  procesos lo toman en el siguiente deploy/restart. Rotar la key de un hotel
  pasa de "editar N archivos" a "un cambio + redeploy".
- **Auditoría**: cada lectura queda registrada (quién, cuándo, qué secreto).
- **Separación de entornos**: `dev`, `staging`, `prod` son espacios distintos.
  Dev usa recursos aislados (Mongo propio, sandbox de Cobre/Autocore — ya
  existen las credenciales `_DEV`); un dev junior jamás ve los valores de prod.

### 4.3 Opciones evaluadas y recomendación

| Opción | Costo de adopción | Operación | Cuándo elegirla |
|--------|-------------------|-----------|-----------------|
| **Doppler** (SaaS) | Muy bajo: CLI + `doppler run`, UI clara, sync a CI | Cero infra propia; plan free generoso | **Recomendada para este equipo**: máximo beneficio con mínimo esfuerzo |
| **AWS SSM Parameter Store / Secrets Manager** | Bajo si ya están en AWS; IAM por rol | Sin servidores; Secrets Manager rota RDS etc. automático | Si el hosting ya es AWS |
| **HashiCorp Vault** | Alto: desplegar y operar Vault (HA, unseal, políticas) | Equipo dedicado | Solo con requisitos de compliance fuertes o multi-cloud grande; sobredimensionado hoy |
| **SOPS + age (archivos cifrados en git)** | Bajo | Manual: rotar = re-cifrar y redeploy; auditoría limitada | Alternativa low-cost si no se quiere SaaS; mejor que `.env` plano, peor que las demás |

**Recomendación: Doppler** (o SSM si la infra está en AWS). Razón: el problema
de este proyecto es de **proceso**, no de tecnología exótica — necesita
rotación fácil, entornos separados y auditoría YA, con un equipo pequeño y sin
operar infraestructura nueva.

### 4.4 Plan de migración (= PR-4.6, sin downtime)

| Paso | Acción | Sub-agente | Validación |
|------|--------|------------|------------|
| S1 | Inventario y clasificación de las ~40 vars: secreto vs config, dueño, entorno, ¿rotable? (sale del Explorador 3 de Fase 4) | Explorador | tabla completa en el sub-plan |
| S2 | Crear `.env.example` versionado (nombres + comentario, sin valores) y separar conceptualmente config de secretos en `envs.ts` | Implementador | dev nuevo puede arrancar el driver solo con el example |
| S3 | Crear proyecto en el gestor con entornos `dev`/`prod`; cargar primero **dev** con recursos AISLADOS (Mongo propio + credenciales `_DEV`/sandbox) | humano + Implementador | `doppler run -- npm run start:dev` funciona sin `.env` |
| S4 | Integrar CI: el workflow toma secretos del gestor (service token), no de GitHub Secrets duplicados | Implementador | CI verde sin secretos en el repo |
| S5 | Prod: token de servicio en el servidor; arranque vía `doppler run --` (o equivalente SSM); **eliminar el `.env` del disco del servidor** | humano (deploy) | API arranca; auditoría registra las lecturas |
| S6 | **Rotación completa post-migración**: TODOS los secretos actuales se consideran expuestos (años circulando en `.env`s); rotar JWT_SECRET (con ventana de gracia para tokens emitidos), keys de Cobre/Autocore/SendGrid/Cloudinary/Gmail, y las 13 keys de hoteles My Tool coordinando con cada proveedor | humano + Verificador | checklist de rotación con fecha por secreto |
| S7 | Política escrita: prohibido `.env` con valores de prod en laptops; alta/baja de secretos solo por el gestor; revisión trimestral de accesos | humano | documento en `docs/` |

> El paso S6 es el que la mayoría omite y el que más vale: migrar el gestor
> sin rotar es mudar los candados dejando las copias viejas de las llaves.

### 4.5 KPIs de gestión de secretos

| KPI | Línea base | Meta |
|-----|-----------|------|
| Secretos de prod en disco/repos/laptops | ~30 en `.env` copiado | 0 |
| Tiempo de rotar un secreto | horas–días (manual, multi-máquina) | < 15 min (central + redeploy) |
| Secretos rotados tras la migración | 0 % | 100 % de los críticos (S6) |
| Auditoría de acceso a secretos | inexistente | 100 % de lecturas registradas |
| Entornos con secretos separados | 1 (dev = prod) | dev / prod aislados |
| Onboarding: arrancar la API en local | requiere que alguien pase el `.env` | `git clone` + driver, o acceso dev del gestor |

---

## 5. Cronograma consolidado

| Semana | Fase 2 | Fase 3 | Fase 4 |
|--------|--------|--------|--------|
| 1 | Etapa P (exploradores en paralelo) + GATE + PRs 2.1–2.3 en paralelo | — | — |
| 2 | PRs 2.4–2.6 (secuenciales) + 2.7 en paralelo | Etapa P (paralela con Fase 2 — son agentes de solo lectura) | — |
| 3 | PR 2.8 + cierre KPIs | GATE + PRs 3.1–3.3 en paralelo | — |
| 4 | — | PRs 3.4–3.5 + cierre KPIs | Etapa P + GATE + PR 4.1 |
| 5 | — | — | PRs 4.2–4.4 en paralelo |
| 6 | — | — | PRs 4.5–4.6 |
| 7 | — | — | PRs 4.7–4.8 + prueba de 2 réplicas + cierre KPIs |

Notas:
- Las etapas P de la fase siguiente siempre pueden adelantarse en paralelo
  (los exploradores son de solo lectura, no chocan con implementadores).
- El cronograma asume disponibilidad de revisión humana en los gates; cada
  gate sin atender desplaza su columna, no las demás.
- **Condición de inicio**: Fase 1 del plan general (tests de dinero + CI)
  completada. Si no, la semana 1 se dedica a cerrarla con implementadores en
  paralelo (un agente por suite de tests).

## 6. Tablero de seguimiento

Cada mejora vive en `docs/planes/` con su sub-plan y se actualiza con:

```
estado: [P pendiente | P en curso | GATE | E en curso | V verificación | CERRADA]
prs: #...
kpis: línea base → medido al cierre
```

El cierre de una fase exige: todas sus mejoras CERRADAS, KPIs medidos y
registrados, y e2e + smoke del driver verdes en `main`.
