# PR-2.5 — ReservasPagosService + ReservasEmailsService

> Sub-plan para extracción de lógica de pagos de `ReservasService`.
>
> **Estado:** En preparación (requiere aprobación antes de ejecutar).
>
> **Prerequisitos:** PRs 2.1, 2.2, 2.3, 2.4 mergeadas en `mejoras/plan-implementacion`.
>
> **Bloqueantes para:** PR-2.6 (cancelación reutiliza `ReservasEmailsService`).

---

## 1. Objetivo

Extraer la lógica de **pagos** y **notificaciones de pago** desde `ReservasService` (~1.021 líneas actualmente) hacia dos servicios especializados:

1. **`ReservasPagosService`** — gestión de estados de pago, links, validación de pago a través del webhook de Autocore
2. **`ReservasEmailsService`** — envío de correos relacionados con pagos (reutilizable por Pagos y Cancelación)

Resultado: `ReservasService` se reduce de ~1.021 a ~750 líneas (fachada + métodos no-transferidos).

---

## 2. Métodos a extraer

### 2.1 → ReservasPagosService

| Método | Líneas (aprox.) | Dependencias nuevas | Notas |
|--------|------|---|---|
| `generarLinkPago` | 50 | `AutocoreClient`, `agenciaModel`, `reservasModel`, `LinksPagoService` | Valida agencia y reserva; delega generación a `LinksPagoService` |
| `realizarPagoBilletera` | 15 | `reservasModel`, `AutocoreClient` | Actualiza estado + saldo |
| `pagarAutocoreBalanceReserva` | 20 | `AutocoreClient`, `reservasModel` | Pago de balance pendiente |
| `cambiarEstadoPagoAutocore` | ~140 | `reservasModel`, `ReservasReactivacionService` | **Webhook de Autocore** — el método crítico de cambio de estado (línea 400–545); incluye idempotencia, transición de estados, invalidación de caché, y llamadas a `ReservasReactivacionService` para éxito/fallo |
| `actualizarStatusReservaManual` | ~110 | `reservasModel`, `ReservasEmailsService`, `httpCustomService` | Admin: cambio manual de estado con validaciones (checkin, rol, pago mitad) |

**Total líneas a trasladar:** ~335 líneas.

### 2.2 → ReservasEmailsService

| Método | Líneas | Dependencias | Notas |
|--------|-------|---|---|
| `enviarCorreoSaldoPendienteIntentoCancelacion` | 16 | `SendEmailCustomService`, plantilla `notificacionSaldoPendienteIntentoCancelacion` | Privado hoy; será público y inyectado por Pagos + Cancelación |

**Total líneas a trasladar:** ~16 líneas.

---

## 3. Decisiones de diseño

### D1 — ReservasPagosService como coordinador de estados

**Decisión:** `ReservasPagosService` maneja TODAS las transiciones de estado de pago, incluyendo la más crítica: el webhook `cambiarEstadoPagoAutocore`. Los métodos de apoyo (`generarLinkPago`, `realizarPagoBilletera`, `pagarAutocoreBalanceReserva`) quedan acá porque son parte de la orquestación de pagos, no de cancelación.

```ts
// src/reservas/services/reservas-pagos.service.ts
@Injectable()
export class ReservasPagosService {
  constructor(
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    private readonly autocoreClient: AutocoreClient,
    private readonly linksPagoService: LinksPagoService,
    private readonly reactivacionService: ReservasReactivacionService,
    private readonly emailsService: ReservasEmailsService,
  ) {}

  async generarLinkPago(generateLinkDto: GenerateLinkDto, agencia: Types.ObjectId) { /* ... */ }
  async realizarPagoBilletera(dto: PagoReservaBilleteraDto) { /* ... */ }
  async pagarAutocoreBalanceReserva(reservaId: string) { /* ... */ }
  async cambiarEstadoPagoAutocore(payload: {...}) { /* ... */ }
  async actualizarStatusReservaManual(reservaId: string, status: ValidPaymentStatus, ...) { /* ... */ }
}
```

### D2 — ReservasEmailsService como servicio puro

**Decisión:** `ReservasEmailsService` es un **servicio hoja** (sin inyección de otros servicios de dominio) que expone métodos públicos de envío de correos. Actúa como intermediario entre servicios de pagos/cancelación y `SendEmailCustomService`.

```ts
// src/reservas/services/reservas-emails.service.ts
@Injectable()
export class ReservasEmailsService {
  constructor(
    private readonly emailService: SendEmailCustomService,
    private readonly logger: Logger,
  ) {}

  async enviarCorreoSaldoPendienteIntentoCancelacion(
    reserva: Reserva,
    recipientEmail: string,
  ): Promise<void> { /* ... */ }
}
```

### D3 — Inyección en ReservasService como fachada

**Decisión:** `ReservasService` inyecta `ReservasPagosService` y las anteriores (`ReservasBookingService`, etc.) y delega métodos de pago:

```ts
// src/reservas/reservas.service.ts (simplificado)
@Injectable()
export class ReservasService {
  constructor(
    /* ... existentes ... */
    private readonly reservasBookingService: ReservasBookingService,
    private readonly reactivacionService: ReservasReactivacionService,
    private readonly pagosService: ReservasPagosService, // NUEVO
  ) {}

  async generarLinkPago(dto: GenerateLinkDto, agencia: Types.ObjectId) {
    return this.pagosService.generarLinkPago(dto, agencia);
  }
  // ... delegaciones restantes
}
```

Las rutas del controller siguen inyectando `ReservasService`; no hay cambio visible en la API.

### D4 — Idempotencia y anti-duplicate en `cambiarEstadoPagoAutocore`

**Decisión:** Se preserva exactamente el algoritmo actual de idempotencia:
- Array `reserva.paymenIds` almacena `${transactionId}:${status}` para cada evento procesado
- Duplicados: comparar la clave; si existe, retornar `true` sin mutar estado
- **No se cambia NADA** de la lógica de idempotencia, validación de estados, ni manejo de reactivación en esta PR

### D5 — Manejo de errores en webhook

**Decisión:** El método `cambiarEstadoPagoAutocore` retorna `boolean` (true = procesado o skip idempotente) y NO lanza excepciones (es un webhook de tercero; excepciones generan retries no deseados). El logger registra todos los eventos.

---

## 4. Matriz PR-2.5 × archivos

Rutas relativas a `src/`.

| Creados | Modificados | Eliminados |
|---------|-------------|-----------|
| `reservas/services/reservas-pagos.service.ts` · `reservas/services/reservas-emails.service.ts` · `reservas/services/reservas-pagos.service.spec.ts` | `reservas/reservas.service.ts` (5 métodos → delegaciones) · `reservas/reservas.module.ts` (+2 providers) · `reservas/interfaces/index.ts` | — |

### Verificación de archivos sin colisión

| Archivo | 2.4 | 2.5 | 2.6 |
|---------|-----|-----|-----|
| `reservas/reservas.service.ts` | ✔ | ✔ | ✔ |
| `reservas/reservas.module.ts` | ✔ | ✔ | ✔ |
| `reservas/services/reservas-booking.service.ts` | ✔ | — | — |
| `reservas/services/reservas-reactivacion.service.ts` | ✔ | — | — |
| `reservas/services/links-pago.service.ts` | ✔ | — | — |
| `reservas/services/reservas-pagos.service.ts` | — | ✔ (crear) | — |
| `reservas/services/reservas-emails.service.ts` | — | ✔ (crear) | ✔ (reutilizar) |

**Nota:** 2.5 y 2.6 comparten `reservas-emails.service.ts` (inyectada por ambas), pero la inyección es **aditiva**: 2.5 la crea, 2.6 la reutiliza. Cero edición de la misma línea de código.

---

## 5. Dependencias inyectadas (grafo acíclico)

```
ReservasPagosService ─→ AutocoreClient
                    ├→ LinksPagoService (ya existe, de 2.4)
                    ├→ ReservasReactivacionService (ya existe, de 2.4)
                    ├→ ReservasEmailsService (NUEVO)
                    └→ Mongo: Reserva, Agencia models

ReservasEmailsService ─→ SendEmailCustomService

ReservasService ─→ ReservasPagosService (delegación)
```

**Garantía:** Ningún ciclo. `ReservasEmailsService` NO inyecta a `ReservasPagosService` (unidireccional).

---

## 6. Plan de tests

Infraestructura: `jest`, `supertest`, `mongodb-memory-server@11`, driver `run-agencias-api`.

### Test suite: `reservas-pagos.service.spec.ts`

| Caso | Método | Líneas | Entrada | Salida esperada | Protege |
|------|--------|--------|---------|-----------------|---------|
| 1 | `cambiarEstadoPagoAutocore` | 10 | payload válido, primer pago → "aplicado" | `reserva.status = mitad`, `pagadoPrimeraMitad = true`, evento en `paymenIds` | transición mitad |
| 2 | ídem | 10 | segundo pago → "aplicado" | `status = total`, `paymenIds.length = 2` | transición total |
| 3 | ídem | 10 | pago duplicado (misma clave en `paymenIds`) | retorna `true`, NO muta estado | idempotencia |
| 4 | ídem | 5 | payload missing `external_ref_id` | retorna `true`, logs error | validación entrada |
| 5 | ídem | 10 | status "rechazado" sin `pagoValidator` | `status = rejected`, llama `handleReactivacionPagoFallido` si `esReactivacion` | rechazo + reactivación |
| 6 | ídem | 10 | status "rechazado" con `pagoValidator` | `pagadoPrimeraMitad = false`, `status = rejected`, luego reactivación | rechazo de pago-segundo |
| 7 | `actualizarStatusReservaManual` | 15 | cambio a cancelado + primera mitad pagada + es super-admin | estado cambia, se permite | override super-admin |
| 8 | ídem | 15 | cambio a cancelado + primera mitad pagada + NO super-admin | lanza `BadRequestException`, envía correo vía `emailsService` | bloqueo + correo |
| 9 | `generarLinkPago` | 10 | agencia válida, reserva no pagada | retorna link vía `LinksPagoService` | generación link |
| 10 | ídem | 5 | reserva ya pagada (status = total) | lanza `BadRequestException` | validación estado |

**Total:** 10 casos core + cobertura de ramas (status "en proceso", "cancelado", "tarjeta no válida", default).

### Test suite: `reservas-emails.service.spec.ts`

| Caso | Método | Entrada | Salida | Protege |
|------|--------|---------|--------|---------|
| 1 | `enviarCorreoSaldoPendienteIntentoCancelacion` | reserva + email | llamada a `SendEmailCustomService.sendEmail` con HTML correcto | plantilla renderizada |
| 2 | ídem | email vacío | no lanza, envía a fallback/log | manejo borde |

**Nota:** Tests unitarios; no mockeamos `SendEmailCustomService` en el spec de emails (queremos que se invoque de verdad en env de test).

### e2e: `mytool-reservas.e2e-spec.ts` (reutilizar)

- Webhook POST `/agencias/v1/webhooks/autocore/pago-reserva` con payload de pago → verifica transición de estado en BD
- Cambio manual de estado vía PATCH → verifica autorización y correo enviado (mock de SendGrid / inspection de logs)
- Validación de idempotencia: webhook duplicado → estado NO cambia

---

## 7. Cambios en ReservasService (fachada)

Línea actual total: **1.021 líneas**.
Línea estimada post-PR-2.5: **~750 líneas** (después de extraer ~271 líneas a servicios nuevos + las de PR-2.4).

### Métodos que pasan a delegaciones

```ts
// ANTES (línea 87)
async generarLinkPago(generateLinkDto: GenerateLinkDto, agencia: Types.ObjectId) {
  // ... 50 líneas ...
}

// DESPUÉS (línea 87)
async generarLinkPago(generateLinkDto: GenerateLinkDto, agencia: Types.ObjectId) {
  return this.pagosService.generarLinkPago(generateLinkDto, agencia);
}
```

Lo mismo para `realizarPagoBilletera`, `pagarAutocoreBalanceReserva`, `cambiarEstadoPagoAutocore`, `actualizarStatusReservaManual`.

### Inyecciones en constructor

```ts
constructor(
  @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
  @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
  private readonly emailService: SendEmailCustomService,
  private readonly httpCustomService: HttpCustomService,
  private readonly cancellationTasksQueueService: CancellationTasksQueueService,
  private readonly myToolBookingService: MyToolBookingService,
  private readonly reservasSearchService: ReservasSearchService,
  private readonly reservasBookingService: ReservasBookingService,
  private readonly reservasReactivacionService: ReservasReactivacionService,
  private readonly linksPagoService: LinksPagoService,
  private readonly pagosService: ReservasPagosService, // NUEVO
) {
  // ...
}
```

### Eliminación de métodos privados

- `enviarCorreoSaldoPendienteIntentoCancelacion` pasa a `public` en `ReservasEmailsService`; línea 249 en `ReservasService` se elimina

---

## 8. Cambios en ReservasModule

```ts
// src/reservas/reservas.module.ts

@Module({
  imports: [
    AutocoreModule, // de PR-2.2
  ],
  controllers: [ReservasController],
  providers: [
    ReservasService,
    ReservasSearchService,   // de PR-2.1
    ReservasBookingService,  // de PR-2.4
    ReservasReactivacionService, // de PR-2.4
    LinksPagoService,        // de PR-2.4
    ReservasPagosService,    // NUEVO — 2.5
    ReservasEmailsService,   // NUEVO — 2.5
    CancellationTasksQueueService,
    MyToolBookingService,
    ReservasCountCacheService, // de PR-2.1
  ],
  exports: [ReservasService], // controller usa `ReservasService`, no los internos
})
export class ReservasModule {}
```

---

## 9. Plan de rollback

| Acción | Seguridad |
|--------|-----------|
| `git revert` del squash de PR-2.5 | `ReservasService` vuelve a tener los 5 métodos inline. Los métodos de PR-2.4 (`ReservasBookingService`, etc.) siguen intactos porque están en archivos disjuntos. Cero complicación. |

**Timing:** ~ 10 segundos si algún KPI falla.

---

## 10. Riesgos y mitigación

| # | Riesgo | Mitigación |
|---|--------|-----------|
| R1 | `cambiarEstadoPagoAutocore` es el webhook más crítico; cambiar de archivo podría desincronizar el manejo | No se cambia NINGUNA lógica; es un traslado 1:1. Tests de idempotencia cubren retries. |
| R2 | `ReservasEmailsService` utilizada por Pagos y Cancelación; si falla en 2.5, Cancelación (2.6) hereda el error | Suite de tests de emails separada en 2.5; 2.6 solo reutiliza. Si tests de 2.5 pasan, 2.6 está seguro. |
| R3 | Inyección circular si alguien hace `ReservasEmailsService` ← `ReservasPagosService` ← `ReservasEmailsService` | Arquitectura verificada: `ReservasEmailsService` tiene CERO inyecciones de servicios de dominio (solo `SendEmailCustomService`). Acíclica. |
| R4 | Consumidores fuera de `ReservasModule` podrían intentar inyectar `ReservasPagosService` directamente | Privado a `ReservasModule` (no exportado). Acceso solo a través de `ReservasService`. |
| R5 | El webhook recibe payloads con `external_ref_id` inválido; error de parsing podría aflorar como excepción | Manejo actual: log + retorna `true` (silencio a tercero). Se preserva exactamente. |

---

## 11. Checklist de verificación (post-implementación)

- [ ] `reservas-pagos.service.spec.ts` corre con cobertura ≥95%
- [ ] `reservas-emails.service.spec.ts` corre sin errores
- [ ] e2e `test/mytool-reservas.e2e-spec.ts` 100% verde
- [ ] `npm run build` sin errores
- [ ] `npm run lint` sin problemas de eslint
- [ ] `node .claude/skills/run-agencias-api/driver.mjs` (smoke test) pasa
- [ ] `ReservasService` líneas finales ≤ 800
- [ ] Diff de `api-docs-json`: cero cambios (firma idéntica)
- [ ] Logs de reversión: `git revert` produce squash limpio sin conflictos
- [ ] grep de métodos privados: ninguno referencia `enviarCorreoSaldoPendienteIntentoCancelacion` fuera de `ReservasEmailsService`

---

## 12. Orden de ejecución recomendado

1. **Implementador** (worktree aislado):
   - Crear `reservas-emails.service.ts` (simple, sin dependencias complejas)
   - Crear `reservas-pagos.service.ts` (reutiliza existentes + emailsService)
   - Crear `reservas-pagos.service.spec.ts` + `reservas-emails.service.spec.ts`
   - Modificar `reservas.service.ts` (delegaciones + eliminación de métodos)
   - Modificar `reservas.module.ts` (providers)
   - `npm run build && npm run lint`

2. **Verificador** (después de push a rama):
   - `npm run test:e2e` (cobertura completa de payloads de pago)
   - `node .claude/skills/run-agencias-api/driver.mjs serve` → probar manualmente webhook en Swagger
   - `npm run build` final

3. **Revisor** (código review):
   - Verificar ningún ciclo de inyecciones
   - Validar que `cambiarEstadoPagoAutocore` es traslado 1:1 (no cambios lógicos)
   - Checklist de riesgos (R1–R5) completado

4. **Merge** a `mejoras/plan-implementacion`

---

## 13. Línea base de KPIs (Fase 2)

Resultado esperado tras cerrar PR-2.5:

| KPI | Línea base actual | Meta Fase 2 | Estado tras 2.5 |
|-----|------------------|-----------|-----------------|
| `reservas.service.ts` líneas | 1.021 | ≤ 400 | ~750 (falta 2.6) |
| Métodos de `ReservasService` duplicando lógica | ~2 (payment states, emails) | 0 | 0 |
| Diferencia de archivos con `HttpCustomService` | 3 | 1 (solo fachada) | 1 ✓ |
| E2E verde | ✓ (mytool-reservas) | ✓ (completo) | ✓ |

---

## Aprobación requerida

Este sub-plan requiere aprobación antes de iniciar PR-2.5.

**Puntos de decision:**
1. ¿Se acepta la extracción de los 5 métodos listados en §2.1?
2. ¿Se acepta la arquitectura de dependencias en §3 (acíclica)?
3. ¿Se acepta que `cambiarEstadoPagoAutocore` es traslado 1:1 sin cambios lógicos (D5)?
4. ¿Se acepta que `ReservasEmailsService` es un servicio hoja sin inyecciones de dominio (D2)?

Si hay dudas o sugerencias, marca los riesgos en §10 y detalla los cambios propuestos.
