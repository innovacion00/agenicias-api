# Fase 2 — Diseño final (Arquitecto)

> Estado: GATE (pendiente de aprobación humana).
> Insumos: `fase2-inventario-reservas.md`, `fase2-inventario-http.md`,
> `fase2-diff-busquedas.md`, `fase2-inventario-errores.md`, verificados contra
> el código en `src/` el 2026-06-10.
>
> Correcciones a los inventarios tras verificación:
> 1. El constructor de `ReservasService` incluye además `@InjectConnection() connection: Connection` (omitido en el inventario 1).
> 2. `common/` hoy NO importa de features (línea base real del KPI: 0). El problema es de **ubicación**: los contratos de Autocore/Cobre viven en `src/common/interface/` y 10 archivos de features los importan vía el barrel `'src/common/interface'`.
> 3. `buildLinkPagoForReserva` (línea 523) lo usan Pagos (`generarLinkPago`, 590) **y** Booking/Reactivación (`reactivarReservaCancelada` 2957, `reutilizarReactivacionPendiente` 3017): el acoplamiento Pagos↔Booking es bidireccional.
> 4. `enviarCorreoSaldoPendienteIntentoCancelacion` (802) se llama desde `cancelarReserva` (866), `actualizarStatusReservaManual` (2056, Pagos) y `cancelarReservaMyTool` (2582).
> 5. **No existe ningún `*.spec.ts` en `src/`** y `test/` solo tiene `app.e2e-spec.ts` y `mytool-reservas.e2e-spec.ts`: la Fase 1 (tests de dinero) NO está cerrada. Ver §6-R1.

---

## 1. Decisiones de diseño cerradas

### D1 — Clientes HTTP: módulos top-level `src/autocore/` y `src/cobre/`

**Decisión:** módulos Nest propios, NO `common/clients`.

```
src/autocore/
  autocore.module.ts        # exporta AutocoreClient; imports: HttpModule
  autocore.client.ts        # 15 métodos Autocore + isAlreadyCanceledResponse (privado)
  interfaces/               # contrato Autocore: autocoreCartera/* + disponibilidad/* + reserva/* (movidos)
    index.ts
src/cobre/
  cobre.module.ts           # exporta CobreClient
  cobre.client.ts           # generateAuthToken (privado), createBolcillo,
                            # createCounterParty y generatePaymenLink (@deprecated, huérfanos)
  interfaces/               # cobre/* (movidos)
```

Justificación: `common/` debe quedar sin conocimiento de integraciones; un módulo
por proveedor hace explícito qué feature depende de qué proveedor y es vigilable
con `import/no-restricted-paths`.

**Interfaces compartidas con DTOs de features** (`IreservaInfoBd`, `ValidCities`,
`IdisponibilidadLayout`, etc.): son el **contrato del proveedor** → viven en
`src/autocore/interfaces/`. Dirección permitida: feature → cliente; un cliente
jamás importa de un feature. Para no tocar los 10 archivos de features en PR-2.2,
el barrel `src/common/interface/index.ts` queda como **re-export deprecado** de
las nuevas ubicaciones; PR-2.8 reescribe los imports y lo elimina.
`VueloMaarLabEntry` no es contrato Autocore: queda en el barrel hasta PR-2.8, que
lo mueve a `src/cotizaciones/interfaces/`.

**`axiosError()`**: helper puro compartido en `src/common/helpers/axios-error.helper.ts`
(sin estado, sin deps de features) usado por ambos clientes.

**Prod/dev Autocore**: se mantiene tal cual — solo `getDisponibilidadAutocore` y
`getDisponibilidadPersonas` aceptan `dev?: boolean`; el resto usa headers prod
siempre. Cero cambio de semántica en la extracción.

`HttpCustomService` queda como fachada `@deprecated` que delega método a método en
los clientes (firmas idénticas) hasta PR-2.8.

### D2 — Firma definitiva de `CriterioBusquedaReserva`

**Decisión:** unión discriminada SOLO para los 4 listados; `buscarPorChatbotId`
queda como **método público separado** del SearchService (no entra en `buscar()`).

```ts
// src/reservas/interfaces/criterio-busqueda-reserva.interface.ts
export type CriterioBusquedaReserva =
  | { tipo: 'agente';  valor: string; page?: number; all?: boolean }
  | { tipo: 'agencia'; valor: string; page?: number; all?: boolean }
  | { tipo: 'huesped'; valor: string; page?: number; all?: boolean }
  | { tipo: 'estado';  valor: ValidPaymentStatus; page?: number; all?: boolean };

export interface ContextoUsuario {
  userId: Types.ObjectId;
  agenciaId: Types.ObjectId;
  roles: string[];
}

export interface RespuestaPaginadaReservas {
  data: any[];
  meta: { total: number; sumaTotales: number; page?: number; pageSize?: number; totalPages?: number };
}

export interface RespuestaChatbotId {
  data: any | null;
  found: boolean;
  sumaTotales?: number;
}
```

Justificación: un retorno `A | B` según el discriminante obligaría a casts; el
contrato `{ data, found, sumaTotales? }` del chatbot se preserva **byte a byte**
como adaptador que reutiliza las primitivas del motor, no su paginación.

Reparto motor/estrategias:
- **Motor**: escape de regex aplicado a TODOS los tipos de texto (fix intencional
  A3, con test), `PAGE_SIZE=15`, `MAX_SKIP=10000`, populate fijo, sort
  `{createdAt: -1}`, count cacheado, `calcularSumaTotalesPorFiltro`, forma del meta.
- **Estrategia por tipo**: construcción del filtro, incl. query previa con
  early-exit (`agente` sobre `User`, `agencia` sobre `Agencia`) y su filtro por rol
  propio (NO se unifica su semántica — divergencia 3 del diff). La normalización
  trim+colapso de espacios queda SOLO en `huesped`.
- **Alcance de PR-2.1**: los 9 métodos de búsqueda/listado (no solo los 5
  `buscarPor*`), porque `getAllReservas`/`getReservasByUser`/`getReservasByAgencia`
  comparten `getCachedCount`/`calcularSumaTotalesPorFiltro`. Todos son lecturas.
- El caché va a `ReservasCountCacheService` (mapa TTL 60 s + suma de totales)
  detrás de la interfaz `ICountCache` que PR-3.4 reimplementará sobre Redis.

### D3 — Acoplamientos Pagos↔Booking y Pagos↔Cancelación: colaboradores hoja, sin `forwardRef`

**Decisión:** extraer los helpers compartidos a **servicios hoja** dentro de
`src/reservas/services/` (mismo módulo Nest, cero ciclos):

| Colaborador nuevo | Contiene | Dependencias | Lo inyectan |
|---|---|---|---|
| `LinksPagoService` | `buildLinkPagoForReserva` | `AutocoreClient` | Pagos y Reactivación |
| `ReservasReactivacionService` | `reactivarReservaCancelada`, `reutilizarReactivacionPendiente`, `buildReservaInfoAutocoreFromReserva`, `handleReactivacionPagoExitoso`, `handleReactivacionPagoFallido` | `reservaModel`, `AutocoreClient`, `SendEmailCustomService`, `LinksPagoService` | fachada (endpoint `reactivar`) y Pagos (`cambiarEstadoPagoAutocore`) |
| `ReservasEmailsService` | `enviarCorreoSaldoPendienteIntentoCancelacion` | `SendEmailCustomService` + plantillas | Pagos y Cancelación |

Grafo resultante (acíclico): `Booking → LinksPago`; `Pagos → {LinksPago,
Reactivacion, Emails}`; `Cancelacion → {Emails, CancellationTasksQueueService}`.
Ningún servicio de dominio inyecta a otro servicio de dominio; `forwardRef`
prohibido y además innecesario. Se descartó EventEmitter2: `handleReactivacion*`
se `await`ea inline hoy y un bus asíncrono cambiaría la semántica de errores del
webhook de pago.

### D4 — Formato global de errores y convivencia con el filtro de vuelos

**Decisión:** `GlobalExceptionFilter` registrado con `APP_FILTER` en
`app.module.ts`, en **modo superset-compatible**: nunca cambia `statusCode` ni
`message`; solo AÑADE campos.

```jsonc
{
  "statusCode": 400,
  "message": ["email must be an email"],   // EXACTAMENTE lo que Nest produce hoy
  "error": "Bad Request",                  // si existía
  "correlationId": "9f2c…",                // req.id de pino-http
  "timestamp": "2026-06-10T14:30:45.123Z",
  "path": "/agencias/v1/reservas"
}
```

Reglas del filtro:
1. **HttpException (cualquiera)**: passthrough de `getResponse()` + los 3 campos nuevos.
2. **Mongo `code === 11000`**: replica a ErrorManager — 400 con
   `` `${JSON.stringify(error.keyValue)} existente en BD` `` + `details.duplicateKey`.
3. **Error desconocido (incl. AxiosError no atrapado)**: 500 con
   `message: 'Revisar logs'` (idéntico a ErrorManager — NO se renombra en esta
   fase); stack y payload del tercero SOLO al log Pino con el mismo `correlationId`.
4. **El mapeo AxiosError→502 queda explícitamente FUERA de la Fase 2** (cambio de
   contrato observable; PR coordinada posterior).
5. **`correlationId`**: PR-2.3 configura `genReqId: () => randomUUID()` en
   `LoggerModule.forRoot` (hoy pino-http usa un contador por proceso).

**Convivencia con vuelos:** el filtro de `VuelosController` está aplicado con
`@UseFilters` a nivel de controller; el filtro más específico gana SIEMPRE sobre
`APP_FILTER` — no se toca nada de `src/vuelos/` en la Fase 2.

### D5 — Destino de `ErrorManager` y de los ~66 try/catch

- **PR-2.3**: ErrorManager NO se toca (el filtro replica sus dos mapeos).
- **PRs 2.4–2.6**: en los servicios nuevos de reservas se eliminan los try/catch
  cuyo cuerpo sea exactamente `logger.error + errorManager.handle(error)` (16).
  **Regla cerrada:** el `statusCode` nunca cambia; los textos de `message` SOLO
  pueden cambiar en respuestas 5xx y cada caso se lista en la PR como fix
  intencional. En <500, si un catch altera el mensaje, el catch se conserva.
  Los catch con lógica real (compensaciones, mapeos) se conservan siempre.
- **PR-2.8**: `ErrorManager` se marca `@deprecated` y se renombra el archivo
  (`handler-error.helper.ts`). Los ~50 usos restantes fuera de reservas NO se
  eliminan en Fase 2 (inofensivos bajo el filtro; KPI de tendencia en CI).

---

## 2. Matriz PR × archivos

Rutas relativas a `src/` salvo indicación. **C**reado / **M**odificado / **E**liminado.

| PR | Creados | Modificados | Eliminados |
|----|---------|-------------|------------|
| **2.1 búsquedas** | `reservas/services/reservas-search.service.ts` · `reservas/services/reservas-count-cache.service.ts` · `reservas/interfaces/criterio-busqueda-reserva.interface.ts` · `reservas/services/reservas-search.service.spec.ts` | `reservas/reservas.service.ts` (9 métodos → wrappers) · `reservas/reservas.module.ts` (+2 providers) · `reservas/interfaces/index.ts` | — |
| **2.2 clientes** | `autocore/autocore.module.ts` · `autocore/autocore.client.ts` · `autocore/interfaces/**` · `cobre/cobre.module.ts` · `cobre/cobre.client.ts` · `cobre/interfaces/**` · `common/helpers/axios-error.helper.ts` | `common/services/http-custom.service.ts` (fachada `@deprecated`) · `common/common.module.ts` · `common/interface/index.ts` (re-export deprecado) · `common/helpers/index.ts` | archivos físicos de `common/interface/{autocoreCartera,cobre,disponibilidad,reserva}/` (movidos; `vuelo-maarlab.interface.ts` se queda) |
| **2.3 filtro** | `common/filters/global-exception.filter.ts` · `common/filters/index.ts` · `test/error-format.e2e-spec.ts` | `app.module.ts` (`APP_FILTER` + `genReqId`) | — |
| **2.4 booking** | `reservas/services/reservas-booking.service.ts` · `reservas/services/reservas-reactivacion.service.ts` · `reservas/services/links-pago.service.ts` | `reservas/reservas.service.ts` · `reservas/reservas.module.ts` (importa `AutocoreModule`) | — |
| **2.5 pagos** | `reservas/services/reservas-pagos.service.ts` · `reservas/services/reservas-emails.service.ts` | `reservas/reservas.service.ts` · `reservas/reservas.module.ts` | — |
| **2.6 cancelación** | `reservas/services/reservas-cancelacion.service.ts` | `reservas/reservas.service.ts` (queda fachada pura ≤400 líneas) · `reservas/reservas.module.ts` | try/catch redundantes en los servicios nuevos |
| **2.7 plantillas** | `notificaciones/templates/*.hbs` · `notificaciones/templates/render.helper.ts` · specs snapshot | `config/constants/<plantillas>.ts` (funciones `notificacion*` conservan firma) · `package.json` (+`handlebars`) | — |
| **2.8 mecánica final** | `cotizaciones/interfaces/vuelo-maarlab.interface.ts` | 7 consumidores restantes de `HttpCustomService` → clientes y sus módulos · imports de `'src/common/interface'` → `'src/autocore/interfaces'` (10 archivos) · `reservas/reservas.controller.ts` (inyecta los 4 servicios) · renames: `sing-in.dto.ts`→`sign-in.dto.ts`, `hendler-error`→`handler-error`, `notificaiconReservaGrupo`→`notificacionReservaGrupo`, `ICreateAgenciaResponce`→`ICreateAgenciaResponse` | `common/services/http-custom.service.ts` · `reservas/reservas.service.ts` (fachada) · barrel `common/interface/` |

### Verificación de disjunción de las PRs paralelas (2.1 ∥ 2.2 ∥ 2.3)

| Archivo | 2.1 | 2.2 | 2.3 |
|---|---|---|---|
| `reservas/reservas.service.ts`, `reservas.module.ts`, `reservas/interfaces/*` | ✔ | — | — |
| `common/services/*`, `common/common.module.ts`, `common/interface/*`, `common/helpers/*`, `autocore/`, `cobre/` | — | ✔ | — |
| `common/filters/*`, `app.module.ts`, `test/*` | — | — | ✔ |

**Cero archivos compartidos.** Claves del reparto:
- 2.2 NO toca `app.module.ts`: los módulos nuevos los importa `CommonModule`.
- 2.2 NO toca `reservas.module.ts`: los consumidores siguen inyectando la fachada
  hasta 2.4 (reservas) y 2.8 (resto).
- 2.3 registra el filtro en `app.module.ts` (que 2.2 no toca), no en `main.ts`.
- 2.7 ∥ 2.4–2.6: sin colisión (firmas `notificacion*` no cambian).
- Colisión inevitable: 2.1, 2.4, 2.5, 2.6 comparten `reservas.service.ts` y
  `reservas.module.ts` → **secuenciales por diseño**.

---

## 3. Plan de tests por PR

Infraestructura disponible: `jest`, `supertest`, `mongodb-memory-server@11`,
driver `run-agencias-api`.

| PR | Tests nuevos | Casos clave |
|----|--------------|------------|
| **2.1** | `reservas-search.service.spec.ts` (unit con mongodb-memory-server; se ejecuta el método viejo ANTES del refactor para grabar el resultado esperado) | Las 10 divergencias del diff: (1) contrato chatbotId `{data, found, sumaTotales}` con `data: null`/`found: false`; (2) early-exit agente con 0 usuarios → `{total:0, page:1, pageSize:15, totalPages:0}`; (3) filtros por rol distintos agente vs agencia (NO unificar semántica); (4) FIX INTENCIONAL: `Juan+Garcia (S.A.)` no lanza 500 y matchea literal en agente/agencia, huésped sigue normalizando; (5) `all=true` omite page/pageSize/totalPages; (6) super-admin agencia busca en todas; (7) sumaTotales chatbotId = total de UN doc; (8) `page=10000` capea en MAX_SKIP; (9) estado fuera de [0–6] → 400; (10) wiring controller→service intacto (5 rutas). Más: populate exacto, TTL del caché con `useCache=false`. |
| **2.2** | opcional: unit de `AutocoreClient.cancelarReservas` (flag `alreadyCanceled`) y `createReservaAutocore` (rename `source_of_bussiness`→`source_of_business`) | Protegen: e2e mytool completo + smoke driver + diff de firmas de la fachada = vacío. |
| **2.3** | `test/error-format.e2e-spec.ts` | 404: cuerpo Nest estándar + `correlationId/timestamp/path`; 400 ValidationPipe: `message` sigue siendo `string[]` idéntico; 500 forzado: `message: 'Revisar logs'`; ruta de vuelos conserva `{success:false,…}`; `correlationId` del cuerpo aparece en el log Pino. |
| **2.4** | tests de dinero de Fase 1 sobre booking/reactivación (PRERREQUISITO §6-R1) + unit de `LinksPagoService` y `handleReactivacionPagoExitoso` | e2e mytool + smoke driver. |
| **2.5** | Fase 1 pagos + unit: `cambiarEstadoPagoAutocore` invoca `handleReactivacion*` en los 3 call-sites; `actualizarStatusReservaManual` dispara correo vía `ReservasEmailsService` | ídem. |
| **2.6** | Fase 1 cancelación + unit de encolado y bloqueo por primera mitad pagada; lista explícita de cada try/catch eliminado con justificación (regla D5) | ídem + e2e de formato de error re-ejecutado. |
| **2.7** | snapshot test por plantilla: HTML de la función nueva === HTML de la vieja (snapshots grabados ANTES del cambio) | build + e2e. |
| **2.8** | ninguno nuevo: suite completa + diff vacío de `api-docs-json` antes/después | grep de `HttpCustomService\|common/interface\|sing-in\|hendler\|notificaicon\|Responce` = 0. |

---

## 4. Orden de ejecución y paralelismo

```
            ┌─ PR-2.1 (búsquedas)      ┐
   t0 ──────┼─ PR-2.2 (clientes HTTP)  ┼── paralelas (archivos disjuntos, §2)
            └─ PR-2.3 (filtro global)  ┘
                       │ merge de 2.1 + 2.2 + 2.3
   t1 ── PR-2.4 (booking + reactivación + links-pago)   ┐
   t2 ── PR-2.5 (pagos + emails)                        ├─ secuenciales   ┌─ PR-2.7 (plantillas)
   t3 ── PR-2.6 (cancelación + limpieza try/catch)      ┘                 └─ ∥ con 2.4–2.6 (disjunta)
                       │ merge de 2.6 y 2.7
   t4 ── PR-2.8 (mecánica final: migración consumidores, renames, adiós fachadas)
```

- 2.4 requiere 2.1, 2.2 y 2.3 mergeadas.
- 2.4→2.5→2.6 estrictamente secuenciales (comparten archivos).
- 2.7 puede arrancar en t0 si hay capacidad.
- 2.8 siempre la última.
- Cada PR: Implementador (worktree) → Verificador → Revisor → merge (§0.2 del plan maestro).

---

## 5. Plan de rollback por PR

Principio: **toda PR es un commit (squash) revertible con `git revert` sin tocar
consumidores**, porque las fachadas preservan firmas hasta 2.8.

| PR | Rollback | Por qué es seguro |
|----|----------|-------------------|
| 2.1 | `git revert` del squash | El controller siempre llamó `reservasService.buscarPor*`; el revert restaura la implementación inline. |
| 2.2 | `git revert` | Los 8 consumidores nunca dejaron de inyectar `HttpCustomService`; el barrel re-exportador hace el movimiento transparente en ambos sentidos. |
| 2.3 | `git revert` (o hotfix: quitar el provider `APP_FILTER`, 1 línea) | El filtro es aditivo; nada depende de `correlationId` todavía. |
| 2.4/2.5/2.6 | `git revert` de la PR concreta, en orden inverso si son varias (2.6 → 2.5 → 2.4) | La fachada delega; el revert vuelve a poner el cuerpo en `reservas.service.ts`. Si solo falla un dominio se revierte SOLO su PR. |
| 2.7 | `git revert` | Las funciones `notificacion*` conservaron firma. |
| 2.8 | `git revert` completo (atómica y mecánica a propósito) | Única PR cuyo revert toca muchos archivos: por eso no mezcla NINGÚN cambio de lógica. |

Regla operativa: tras cualquier revert, el Verificador corre build+lint+e2e+driver
sobre la rama antes de continuar.

---

## 6. Riesgos residuales y mitigación

| # | Riesgo | Mitigación |
|---|--------|------------|
| R1 | **Fase 1 (tests de dinero) NO está hecha** (verificado: ningún `*.spec.ts` en `src/`). | **Bloqueante para 2.4–2.6.** 2.1, 2.2, 2.3 y 2.7 SÍ pueden arrancar ya (lecturas, extracción 1:1, filtro aditivo, snapshots). La primera tanda de implementadores cierra Fase 1 en paralelo con 2.1–2.3. |
| R2 | Clientes desconocidos que parseen el cuerpo de error con igualdad estricta de claves. | Formato superset (D4); ventana de observación 48 h tras deploy de 2.3; rollback de 1 línea. |
| R3 | Fix del escape de regex cambia resultados en agente/agencia para inputs con metacaracteres. | Documentado como fix A3; test dedicado; changelog para frontend/chatbot. |
| R4 | Al eliminar try/catch (2.6), mensajes 5xx pueden aflorar distintos a "Revisar logs". | Regla D5: `statusCode` invariable; cambios de texto 5xx listados en la PR; en <500 el catch se conserva. |
| R5 | `forwardRef(() => AgenciasModule)` ya existe en `reservas.module.ts`. | No se añade ningún `forwardRef` nuevo (D3); deshacer ese ciclo queda fuera de fase. |
| R6 | Doble caché de counts si 2.1 se parte mal. | Evitado: TODOS los métodos con caché migran en 2.1 a `ReservasCountCacheService` único (interfaz `ICountCache`). |
| R7 | Métodos huérfanos de Cobre y `pagoReservaBalanceAutocore` podrían tener consumidores no visibles. | `@deprecated` + log de deprecación; eliminación solo tras 30 días de logs sin invocaciones. |
| R8 | `ErrorManager` sigue vivo en 8 servicios fuera de reservas al cerrar la fase. | Aceptado: inocuo bajo el filtro; KPI de tendencia con grep en CI; limpieza en fases siguientes. |
| R9 | PR-2.8 grande aunque mecánica (≈20 archivos). | Cero lógica nueva; suite completa + diff vacío de `api-docs-json`; si el Revisor la considera excesiva se parte en 2.8a (consumidores+fachadas) y 2.8b (renames). |
