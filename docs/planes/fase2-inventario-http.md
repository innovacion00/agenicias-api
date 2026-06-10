# Fase 2 — Inventario de `HttpCustomService` (Explorador 2)

> Estado: P completada. Insumo para `fase2-diseno.md` y PR-2.2.
> Fuente: `src/common/services/http-custom.service.ts` (~730 líneas).

## Métodos públicos y consumidores

| Método | Línea | Proveedor | Credenciales | Lógica extra | Consumidores |
|--------|-------|-----------|--------------|--------------|--------------|
| `generateAuthToken()` | 102 | Cobre | `cobreUserId`, `cobreSecret` | token de sesión | interno (3 métodos Cobre) |
| `createBolcillo(nombre)` | 119 | Cobre | Bearer interno | valida token | `agencias.service.ts:60` |
| `createCounterParty(...)` | 146 | Cobre | Bearer interno | metadata | **HUÉRFANO** (sin consumidores) |
| `generatePaymenLink(...)` | 187 | Cobre | Bearer + uuid idempotency | amount×100 | **HUÉRFANO** |
| `getDisponibilidadAutocore(..., dev?)` | 227 | Autocore | prod **o dev** según param | validateStatus manual, logging | `integrations.service.ts:64,75`, `reservas.service.ts:1785,1810` |
| `getDisponibilidadPersonas(..., dev?)` | 310 | Autocore | prod **o dev** según param | query params, logging | `booking-personas.service.ts:77` |
| `createReservaAutocore(hotelId, info)` | 402 | Autocore | prod siempre | renombra `source_of_bussiness`→`source_of_business` | `cotizaciones:741`, `reservas:281,2381,2855` |
| `createReservaPersonasAutocore(...)` | 433 | Autocore | prod | default 'Booking Personas' | `booking-personas:795,1000` |
| `editarReservas(chatbotId, update)` | 473 | Autocore | prod | — | `reservas:703` |
| `cancelarReservas(chatbotId)` | 491 | Autocore | prod | **`isAlreadyCanceledResponse()` (línea 46), flag `alreadyCanceled`** | `notificaciones:44,234`, `cancellation-lock-reconciliation:72`, `cancellation-tasks-queue:282`, `reservas:908,1978,2064,2609,3082` |
| `crearAgenciaAutocore(body)` | 523 | Autocore | prod | — | `agencias:79` |
| `setLimiteRecargaAgencia(...)` | 538 | Autocore | prod | — | `agencias:100` |
| `createLinkPagoAutocore(body)` | 557 | Autocore | prod | — | `reservas:531` |
| `createLinkPagoPersonasAutocore(...)` | 574 | Autocore | prod | **payload con URLs hardcodeadas, external_ref_id con timestamp** | `booking-personas:669` |
| `pagoBalanceAutocore(code)` | 645 | Autocore | prod | — | `reservas:621` |
| `pagoReservaBalanceAutocore(body)` | 660 | Autocore | prod | orquesta link+pago | **HUÉRFANO** |
| `recargarCarteraAutocore(...)` | 679 | Autocore | prod | — | `agencias:147` |
| `reembolsoCartera(...)` | 697 | Autocore | prod | — | `cancellation-tasks-queue:225` |
| `obtenerSaldoCartera(agencyId)` | 718 | Autocore | prod | — | `agencias:168` |

**8 servicios consumidores**: agencias, reservas, booking-personas, cotizaciones, integrations, notificaciones, cancellation-lock-reconciliation, cancellation-tasks-queue.

## Interfaces: dónde viven y dónde deberían vivir

**Solo usadas por HttpCustomService (mover al cliente nuevo):**
- Cobre (`src/common/interface/cobre/`): `IrespuestaAuthCobre`, `IrespuestaCreateBolcillo`, `IrespuestaCounterParty`, `IrespuestaGenerarLinkPago`, `MetadataLinkPago` → `src/cobre/interfaces/`.
- Autocore Cartera (`src/common/interface/autocoreCartera/`): `ICreateAgenciaBody`, `ICreateAgenciaResponce` (typo, renombrar en PR-2.8), `ICreatePaymentLinkBody/Response`, `ICreateLinkRecarga`, `IGetSaldoAgencia`, `IPagoBilletera` → `src/autocore/interfaces/`.

**Compartidas con DTOs/entities de features (dependencia invertida real):**
- `IdisponibilidadLayout`, `Iavailability`, `ValidCities` — usadas por DTOs de cotizaciones, reservas y booking-personas.
- `IreservaInfo`, `IreservaInfoBd`, `reservaAutocoreUpdate` — usadas por DTOs/entities de reservas y booking-personas.
- Decisión de diseño: estas son el **contrato de Autocore**, las consumen varios features → pueden vivir en `src/autocore/interfaces/` y los features las importan del cliente (un feature puede depender de un cliente de integración; un cliente no debe depender de features).

## Prod vs Dev de Autocore

- Solo `getDisponibilidadAutocore` y `getDisponibilidadPersonas` soportan dev, vía parámetro booleano.
- El flag lo activa `integrations.service.ts:58`: `roles.includes(ValidIntegrationsRoles.autodoreDev)` (rol de la API key).
- Todo lo demás usa SIEMPRE `autocoreHeaders` (prod).
- Diseño propuesto: `AutocoreClient` recibe `{ env?: 'dev' | 'prod' }` por método de disponibilidad (mantener el comportamiento actual; NO cambiar semántica en la PR de extracción).

## Constantes/env consumidas

- `autocoreConstants.ts`: `autocoreHeaders` (16 usos), `autocoreHeadersDev` (2), `tiposAgencia`.
- `envs`: `cobreApiUrl`, `cobreUserId`, `cobreSecret`, `autocoreUrl` (13 usos), `autocoreUrlDev`, claves prod/dev.

## Propuesta de reparto

- **`CobreClient`** (`src/cobre/`): `generateAuthToken` (privado), `createBolcillo`, `createCounterParty` (@deprecated, huérfano), `generatePaymenLink` (@deprecated, huérfano).
- **`AutocoreClient`** (`src/autocore/`): los 15 métodos Autocore, incluido `isAlreadyCanceledResponse` como privado de `cancelarReserva`.
- `pagoReservaBalanceAutocore` (huérfano): marcar @deprecated; eliminar en PR posterior si nadie lo reclama.
- `axiosError()` (manejador común): extraer a un helper compartido de clientes o duplicar mínimamente — decidir en diseño.
- `HttpCustomService` queda como **fachada deprecada** que delega en los clientes hasta migrar los 8 consumidores; se elimina al final de la Fase 2.

## Regla post-refactor

`common/` no importa nada de `src/<feature>/` — vigilada por ESLint `import/no-restricted-paths` (KPI Fase 2).
