# Fase 2 — Inventario de `reservas.service.ts` (Explorador 1)

> Estado: P completada. Insumo para `fase2-diseno.md`.
> Fuente: análisis exhaustivo de `src/reservas/reservas.service.ts` (~3.150 líneas).

## Métodos públicos (24) y servicio destino

| Servicio destino | Cantidad | Métodos |
|---|---|---|
| **ReservasBookingService** | 6 | `createReserva`, `editarReserva`, `getDisponibilidad`, `getMyToolMappings`, `createReservaMyTool`, `reactivarReservaCancelada` |
| **ReservasPagosService** | 6 | `generarLinkPago`, `realizarPagoBilletera`, `pagarAutocoreBalanceReserva`, `cambiarEstadoPagoAutocore`, `actualizarStatusReservaManual`, `actualizarFechasPagoReserva` |
| **ReservasCancelacionService** | 3 | `cancelarReserva`, `cancelarReservaAdmin`, `cancelarReservaMyTool` |
| **ReservasSearchService** | 9 | `getReservasByUser`, `getReservasByAgencia`, `buscarPorChatbotId`, `buscarPorNombreAgente`, `buscarPorNombreAgencia`, `buscarPorNombreHuesped`, `buscarPorEstado`, `getAllReservas`, `searchReservaMyTool` |

## Estado en memoria del servicio

- `countCache: Map<string, { count, timestamp }>` — TTL 60 s, NO distribuido. Usado por 7 métodos de búsqueda.
- `sumaTotalesCache: object | null` — TTL 60 s, NO distribuido.
- Ambos deben quedar detrás de una interfaz `ICountCache` (PR-3.4) para migrar a Redis en Fase 4.

## Helpers privados (16) y a dónde van

**De caché/conteo (→ SearchService):** `getCachedCount`, `cleanOldCache`, `getSumaTotalesNoCanceladas`, `calcularSumaTotalesPorFiltro`.

**Compartidos entre dominios (riesgo de partición):**
- `enviarCorreoSaldoPendienteIntentoCancelacion` — usado por Pagos Y Cancelación.
- `handleReactivacionPagoExitoso` / `handleReactivacionPagoFallido` — llamados desde `cambiarEstadoPagoAutocore` (Pagos) pero son lógica de Booking/reactivación.
- `buildLinkPagoForReserva` (Pagos), `enqueuePostCancellationTasks` (Cancelación).
- `buildIdFilter`, `construirFiltroPorRol` (Search).
- Helpers MyTool: `generateMyToolLocalizador`, `calculateNights`, `send*Notification` (6 helpers de notificación).

## Riesgos para la partición

1. **Caché en memoria no distribuido** (countCache, sumaTotalesCache) usado por 7 métodos — extraer a servicio propio con interfaz.
2. **Acoplamiento Pagos ↔ Cancelación** vía `enviarCorreoSaldoPendienteIntentoCancelacion` — mover a Cancelación e inyectar.
3. **Pagos → Booking**: `cambiarEstadoPagoAutocore` llama `handleReactivacion*` — candidato a eventos o a inyección explícita BookingService→PagosService (decidir en diseño; evitar dependencia circular).
4. **Duplicación MyTool vs Autocore**: lógica condicional `if (provider === mytool)` repartida en varios métodos — el diseño debe decidir si se introduce un patrón provider (puede posponerse a una PR posterior para no inflar la 2.4).
5. Las notificaciones por email están esparcidas — candidato a `ReservasNotificacionesService` interno o usar el módulo notificaciones existente.

## Dependencias del constructor (a repartir)

Modelos: `reservaModel`, `userModel`, `agenciaModel` (+ otros según método).
Servicios: `HttpCustomService` (Autocore/Cobre), `MyToolBookingService`, `SendEmailCustomService`, colas de cancelación (`CancellationTasksQueueService`).

> Nota de verificación: este inventario fue producido por un agente de solo
> lectura; el Arquitecto debe re-verificar contra el código los métodos
> marcados como ambiguos antes de congelar la matriz PR×archivos.
