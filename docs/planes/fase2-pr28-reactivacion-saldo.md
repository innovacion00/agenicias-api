# PR-2.8 — Reactivación de reservas con validación de saldo previo

> Ajuste del endpoint `POST /reservas/reactivar` para calcular el monto del link de pago según pagos previos en la reserva cancelada (campo `pagadoPrimeraMitad` o consulta al PMS My Tool).

**Estado:** Implementado.

**Prerequisitos:** Reservas Autocore, integración My Tool por hotel (`hotelMyToolConfig` + env `API_<HOTEL>`).

---

## 1. Objetivo

Al reactivar una reserva cancelada, el link de pago ya **no** se genera siempre por el `total`. El backend determina el monto según:

1. Si `pagadoPrimeraMitad === true` en la reserva origen → cobrar `totalMitad`.
2. Si no → consultar el PMS (`POST /api/EstadoCuenta/GetEstadoCuentaReserva`) y comparar la suma de pagos con `totalMitad` y `total`.
3. Si el PMS indica pago total → rechazar la reactivación con `409 REACTIVACION_YA_PAGADA` (sin crear reserva en Autocore ni en BD).

---

## 2. Árbol de decisión

```
reactivarReservaCancelada(reservaOrigen)
│
├─ pagadoPrimeraMitad === true
│     └─> monto = totalMitad (sin consultar PMS)
│
└─ pagadoPrimeraMitad === false
      └─ POST PMS GetEstadoCuentaReserva (host por hotel)
         montoPagado = trunc( Σ result[].pagos[].monto )
         │
         ├─ montoPagado === totalMitad  → monto = totalMitad
         ├─ montoPagado === total       → 409 REACTIVACION_YA_PAGADA
         └─ otro (incl. 0)              → monto = total - montoPagado
```

Reglas cerradas:

- **Normalización:** `Math.trunc` en cada `pagos[].monto` (187425.0000 → 187425).
- **Comparación:** igualdad exacta (`===`).
- **Pagos múltiples:** se **suman** todos los ítems de `pagos` en todos los `result`.

---

## 3. Contrato PMS My Tool

| | |
|--|--|
| **Método** | `POST` |
| **URL** | `{hotelIp}/api/EstadoCuenta/GetEstadoCuentaReserva` |
| **Auth** | Bearer (mismo flujo `authenticate` que el resto de My Tool) |
| **Host por hotel** | `hotelMyToolConfig[slug].ip` → variables `envs.apiAixo`, `apiAzuan`, etc. |

**Body:**

```json
{
  "localizador": "<reservaOrigen.reservaChatbotId>",
  "checkIn": "<reservation.checkin>",
  "checkOut": "<reservation.checkout>"
}
```

**Respuesta (ejemplo con pago):**

```json
{
  "isSuccess": true,
  "message": "Reservas consultadas correctamente.",
  "json": null,
  "result": [
    {
      "reservaId": 14986,
      "localizador": "CB47476514",
      "pagos": [
        {
          "reservaId": 14986,
          "fecha": "2026-06-06T22:55:40",
          "formaPago": "Cr. MasterCard",
          "monto": 187425.0000
        }
      ]
    }
  ]
}
```

El slug del hotel se resuelve con `findSlugByAutocoreId(hotelId)` y fallback `findSlugByHotelName(reservaOrigen.hotel)`.

---

## 4. Cambios en código

| Archivo | Cambio |
|---------|--------|
| `src/config/constants/myToolBookingConstants.ts` | `MY_TOOL_ESTADO_CUENTA_PATH` |
| `src/reservas/services/my-tool-booking.service.ts` | `getEstadoCuentaReserva`, tipos de respuesta |
| `src/reservas/utils/estado-cuenta-reserva.utils.ts` | Lógica pura de normalización, suma y decisión |
| `src/reservas/reservas.service.ts` | `resolverMontoReactivacion`, `buildLinkPagoForReserva(montoOverride?)`, integración en `reactivarReservaCancelada` |
| `src/reservas/reservas.controller.ts` | Swagger actualizado |

### Link de pago en reactivación

- Se sigue invocando `buildLinkPagoForReserva(..., pagoTotal: true, montoOverride)`.
- El `external_ref_id` conserva el sufijo ` pagoTotal` para que el webhook cierre la reserva en un solo pago (`status: total`) y ejecute `handleReactivacionPagoExitoso`.

### Errores HTTP

| Código | `code` | Cuándo |
|--------|--------|--------|
| 409 | `REACTIVACION_SIN_DISPONIBILIDAD` | Autocore sin habitaciones (existente) |
| 409 | `REACTIVACION_YA_PAGADA` | PMS indica pago total |
| 400 | — | Hotel no mapeado a Autocore o no configurado en My Tool |

---

## 5. Orden de implementación (ejecutado)

1. Constante `MY_TOOL_ESTADO_CUENTA_PATH`.
2. `getEstadoCuentaReserva` en `MyToolBookingService`.
3. Util `estado-cuenta-reserva.utils.ts` + spec unitario.
4. `buildLinkPagoForReserva` con `montoOverride`.
5. `resolverMontoReactivacion` + integración en `reactivarReservaCancelada` (incl. rama 409).
6. Swagger del controlador.
7. Tests e2e `test/reactivar-reserva-saldo.e2e-spec.ts` (C1–C6).
8. Documentación (este archivo + manual Autocore + `CLAUDE.md`).
9. `npm run lint`, `npm run build`, e2e.

---

## 6. Pruebas

### Unitarias

- `src/reservas/utils/estado-cuenta-reserva.utils.spec.ts` — ramas del árbol de decisión.
- `src/reservas/services/my-tool-booking.service.spec.ts` — POST autenticado al PMS.

### e2e

`test/reactivar-reserva-saldo.e2e-spec.ts`:

| Caso | Escenario | Esperado |
|------|-----------|----------|
| C1 | `pagadoPrimeraMitad=true` | `amount=totalMitad`, sin llamar PMS |
| C2 | PMS pago = `totalMitad` | `amount=totalMitad` |
| C3 | PMS pago = `total` | 409, sin `createReservaAutocore` |
| C4 | Abono parcial | `amount = total - montoPagado` |
| C5 | Sin pagos | `amount = total` |
| C6 | Webhook `aplicado` con `pagoTotal` | Origen eliminada, nueva en `total` |

```powershell
$env:MONGOMS_VERSION="8.2.1"; npx jest --config ./test/jest-e2e.json test/reactivar-reserva-saldo.e2e-spec.ts
```

---

## 7. Referencias

- Endpoint: `POST /agencias/v1/reservas/reactivar`
- DTO: `src/reservas/dto/reactivar-reserva.dto.ts`
- Webhook post-pago: `POST /agencias/v1/reservas/change-status`
- Manual pagos: `docs/MANUAL_INTEGRACION_PAGOS_AUTOCORE.md` §4.1.1
