# Fase 2 — Inventario de manejo de errores (Explorador 4)

> Estado: P completada. Insumo para PR-2.3 (filtro global de excepciones).

## Uso de `ErrorManager` (`src/common/helpers/hendler-error.helper.ts`)

| Servicio | Llamadas a `errorManager.handle()` | Nota |
|----------|-----------------------------------|------|
| `AuthService` | 30+ | |
| `ReservasService` | 16 | 1 outlier con `console.log` directo (~línea 1822) |
| `BookingPersonasService` | 14+ | |
| `AgenciasService` | 8 | re-lanza `NotFoundException` antes de `handle()` en 3 sitios |
| `IntegrationsService` | 4+ | |
| `NotificacionesService` | 4+ | |
| `MyToolService` | 2 | |
| `EventosService` | 1 | field initializer en vez de constructor |
| `FilesService` | 1 | |
| `VuelosModule` | 0 | usa su propio filtro |
| `CotizacionesService` | 0 | lanza `BadRequestException` directo |

Total: **9 servicios, ~66 invocaciones** del patrón `try/catch → logger.error → errorManager.handle`.

Limitaciones de `ErrorManager`: pierde `error.message` original (500 → "Revisar logs"), sin correlationId/timestamp, no maneja AxiosError de integraciones, param `context` del constructor sin uso.

## Filtro existente de vuelos (`src/vuelos/filters/error-handler.filter.ts`)

- Aplicado SOLO vía `@UseFilters` en `VuelosController` (línea 45) + interceptor local.
- Produce formato propio: `{ success: false, error: { code, message, details?, timestamp, requestId?, source, statusCode }, data? }`.
- Maneja: HttpException estándar, objetos ya estandarizados, errores no manejados (`UNHANDLED_ERROR`), arrays del ValidationPipe (join ', '), y errores de Amadeus/MaarLab con contexto en `data`.

## Catálogo de formatos de error que ven HOY los clientes

1. **Nest estándar** (la mayoría): `{ "message": "...", "error": "Bad Request", "statusCode": 400 }` — incluye ValidationPipe con `message: string[]`.
2. **ErrorManager 500**: `{ "message": "Revisar logs", "error": "Internal Server Error", "statusCode": 500 }`.
3. **ErrorManager Mongo 11000**: `{ "message": "{\"email\":\"x\"} existente en BD", "statusCode": 400 }`.
4. **Filtro de vuelos**: `{ success: false, error: {...}, data? }` (estructura distinta a todo lo demás).
5. **Guards**: `UnauthorizedException`/`ForbiddenException` con mensajes propios (`'API Key y Secret Key son requeridos'`, `'User X needs a valid Role'`, Passport `Unauthorized` plano).
6. **Axios sin mapear** (my-tool, booking-personas): mensaje del tercero embebido en un 500.

## Compatibilidad

- `test/mytool-reservas.e2e-spec.ts`: solo asevera **status HTTP**, nunca estructura del cuerpo de error → bajo riesgo.
- Código interno: NO parsea respuestas de la propia API (los `error.response.data` que existen parsean a Amadeus/MaarLab/MyTool, terceros).
- Riesgo restante: frontends externos desconocidos. **Decisión de diseño pendiente (gate):** el filtro global debe mantener como mínimo `statusCode` y `message` en la raíz (superset del formato Nest estándar), añadiendo `correlationId`, `timestamp`, `path` — así los clientes que leen `message`/`statusCode` no se rompen. El formato `success:false` de vuelos se migra al estándar en una PR posterior coordinada con el frontend de vuelos.

## Requisitos del filtro global (PR-2.3)

Formato objetivo (superset compatible):

```json
{
  "statusCode": 400,
  "message": "Validación fallida",
  "error": "Bad Request",
  "correlationId": "<req.id de Pino>",
  "timestamp": "2026-06-10T14:30:45.123Z",
  "path": "/agencias/v1/reservas",
  "details": { "errors": [{ "field": "email", "message": "must be an email" }] }
}
```

Casos que debe absorber:
1. **ValidationPipe** con `message: string[]` → conservar el array en `details.errors` y un `message` legible (mantener también el array en `message` si se decide compat estricta — decidir en gate).
2. **Mongo 11000** → 400 con `details.duplicateField/duplicateValue` (hoy lo hace ErrorManager; el filtro lo asume y ErrorManager muere).
3. **AxiosError** de integraciones → 502 con `details.source` (`autocore|cobre|mytool|amadeus|maarlab`), mensaje del tercero SOLO en logs.
4. **HttpException re-lanzadas** → passthrough con los campos extra añadidos.
5. **Error desconocido** → 500 con `message: 'Error interno'` + correlationId; stack completo al log Pino con el mismo correlationId.
6. Convivencia temporal con el filtro de vuelos (más específico gana) hasta absorberlo.

Plan de retirada de `ErrorManager`: tras activar el filtro, eliminar los ~66 try/catch+handle módulo por módulo (PRs 2.4–2.6 para reservas; el resto en PRs mecánicas), conservando solo los catch con lógica real (compensaciones, mapeos).
