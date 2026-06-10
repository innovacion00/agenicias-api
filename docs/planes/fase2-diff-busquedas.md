# Fase 2 — Diff semántico de los 5 `buscarPor*` (Explorador 3)

> Estado: P completada. Insumo para PR-2.1 (`ReservasSearchService.buscar`).
> Fuente: `src/reservas/reservas.service.ts` líneas 1198–1722 + controller.

## Tabla comparativa

| Dimensión | `buscarPorChatbotId` | `buscarPorNombreAgente` | `buscarPorNombreAgencia` | `buscarPorNombreHuesped` | `buscarPorEstado` |
|-----------|---|---|---|---|---|
| Líneas | 1198–1235 | 1238–1357 | 1360–1475 | 1478–1633 | 1636–1722 |
| Parámetros | `(chatbotId, userId, agenciaId, roles)` — **sin page/all** | `(nombre, userId, agenciaId, roles, page=1, all=false)` | ídem | ídem | `(status: ValidPaymentStatus, ...)` |
| **Tipo de retorno** | **`{ data: any\|null, found: bool, sumaTotales? }`** | `{ data: any[], meta: {...} }` | ídem | ídem | ídem |
| Búsqueda inicial | exacta en `reservaChatbotId` | `$regex` 'i' en `User.fullName` | `$regex` 'i' en `Agencia.fullName` | `$regex` complejo `$or`/`$expr` en `reservation.firstName/lastName` | exacta en `status` |
| **Escapa regex** | N/A | **NO** ⚠️ | **NO** ⚠️ | **SÍ** (`/[.*+?^${}()\|[\]\\]/g`) | N/A |
| **Normaliza texto** | N/A | NO | NO | **SÍ** (trim + colapsa espacios) | N/A |
| **Query previa + early-exit en 0** | NO | **SÍ** (userModel → `$in`) | **SÍ** (agenciaModel → `$in`) | NO (directo) | NO |
| **Filtro por rol** | `construirFiltroPorRol` | **propio sobre User**: admin→`{agencia: agenciaId}`, user→`{_id: userId}` | **propio sobre Agencia**: no-superadmin→`{_id: agenciaId}` (admin SIN rama especial) | `construirFiltroPorRol` | `construirFiltroPorRol` |
| Rama `all=true` | no existe | meta sin page/pageSize/totalPages | ídem | ídem | ídem |
| PAGE_SIZE / MAX_SKIP | N/A | 15 / 10.000 | 15 / 10.000 | 15 / 10.000 | 15 / 10.000 |
| getCachedCount | N/A | sí (TTL 60 s) | sí | sí | sí |
| Populate | `agenciaId: 'fullName _id emailContacto'` + `userId: 'fullName email'` | ídem | ídem | ídem | ídem |
| Sort | `{ createdAt: -1 }` | ídem | ídem | ídem | ídem |
| **sumaTotales** | **`reserva.total` (un solo doc)** | agregada por filtro | agregada | agregada | agregada |
| 0 resultados | `{ data: null, found: false }` | `{ data: [], meta: { total: 0, page:1, pageSize:15, totalPages:0 } }` | ídem | data vacía sin early-exit | ídem |
| Errores | try/catch + errorManager | ídem | ídem | ídem | ídem |

## Divergencias que deben volverse tests (antes de unificar)

1. `buscarPorChatbotId` retorna `{ data, found, sumaTotales }` con `data` nullable — contrato distinto a los otros 4. **Mantener byte a byte** (lo consume el chatbot).
2. `buscarPorNombreAgente` con 0 usuarios coincidentes hace early-exit con meta `{ total: 0, page: 1, pageSize: 15, totalPages: 0 }`.
3. Filtro por rol de Agente filtra `User.agencia` (admin) / `User._id` (user); el de Agencia filtra `Agencia._id` para TODO no-superadmin (admin no tiene rama propia). Son lógicas distintas: NO unificar su semántica, solo su implementación.
4. `buscarPorNombreHuesped` escapa y normaliza el input; los otros dos por nombre NO (bug A3 del plan general — al unificar, escapar en TODOS es el comportamiento deseado; documentar como fix intencional, con test de que `Juan+Garcia` no rompe en agente/agencia).
5. `all=true` omite `page/pageSize/totalPages` del meta; `all=false` los incluye.
6. `buscarPorNombreAgencia` super-admin busca en todas las agencias; el resto solo la propia.
7. `sumaTotales` en chatbotId = total de UNA reserva; en los demás = suma agregada del filtro completo.
8. MAX_SKIP capea el skip en 10.000 (page alto no revienta, repite la página tope).
9. Validación de `status` ∈ [0–6] en el endpoint de estado.
10. Mapeo de endpoints/query-params del controller debe permanecer idéntico (5 rutas distintas).

## Firma propuesta (a ratificar por el Arquitecto)

```ts
type CriterioBusquedaReserva =
  | { tipo: 'chatbotId'; valor: string }
  | { tipo: 'agente' | 'agencia' | 'huesped'; valor: string; page?: number; all?: boolean }
  | { tipo: 'estado'; valor: ValidPaymentStatus; page?: number; all?: boolean };

interface ContextoUsuario {
  userId: Types.ObjectId;
  agenciaId: Types.ObjectId;
  roles: string[];
}

class ReservasSearchService {
  buscar(criterio: CriterioBusquedaReserva, ctx: ContextoUsuario): Promise<RespuestaBusqueda>;
}
```

- El motor centraliza: escape de regex (todos), paginación (PAGE_SIZE/MAX_SKIP), populate/sort, `getCachedCount`, `calcularSumaTotalesPorFiltro` y la forma del meta.
- Las "estrategias" por tipo aportan solo: construcción del filtro (incl. query previa con early-exit) y el filtro por rol específico.
- `buscarPorChatbotId` conserva su contrato de retorno propio (adapter sobre el motor).

## Dependencias del motor

- `construirFiltroPorRol(userId, agenciaId, roles)`: superadmin→`{}`, admin→`{agenciaId: {$in:[id, idStr]}}`, user→`{userId: {$in:[id, idStr]}}`.
- `calcularSumaTotalesPorFiltro(filter)`: aggregate `$match` + `$group` sum de `$total`.
- `getCachedCount(filter, useCache)`: TTL 60 s, fallback `estimatedDocumentCount()` con filtro vacío.
