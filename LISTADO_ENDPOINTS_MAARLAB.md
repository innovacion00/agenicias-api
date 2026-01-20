# 📋 Listado Completo de Endpoints MaarLab

## Base URL
Todos los endpoints están bajo: `/agencias/v1/vuelos/maarlab/`

---

## 📊 Resumen

| # | Método | Ruta | Descripción | Estado |
|---|--------|------|-------------|--------|
| 1 | POST | `/disponibilidad` | Buscar vuelos disponibles | ✅ |
| 2 | POST | `/paquete` | Crear paquete de vuelo | ✅ |
| 3 | GET | `/equipaje` | Obtener información de equipaje | ✅ |
| 4 | POST | `/extras` | Agregar extras al paquete | ✅ |
| 5 | DELETE | `/extras` | Eliminar extra del paquete | ✅ |
| 6 | POST | `/reservar` | Reservar paquete con pasajeros | ✅ |
| 7 | GET | `/token-pago` | Obtener token de pago | ✅ |
| 8 | GET | `/paquete` | Obtener detalles del paquete | ✅ |
| 9 | GET | `/contrato-atol` | Obtener contrato ATOL | ✅ |
| 10 | POST | `/search-engine/complete-process` | Crear hotel | ✅ |
| 11 | POST | `/travel-agency/complete-process` | Crear agencia de viajes | ✅ |
| 12 | GET | `/search-engine/mapping-external-id/:idSearchEngine` | Mapear external ID | ✅ |

**Total:** 12 endpoints implementados ✅

---

## 1. POST `/agencias/v1/vuelos/maarlab/disponibilidad`

**Descripción:** Busca vuelos disponibles usando la API de MaarLab Oceanflights.

**Método:** `POST`

**Body (MaarLabFlightSearchDto):**
```json
{
  "origin": "MAD",
  "destination": "TFS",
  "departureDate": "2026-02-20",
  "returnDate": "2026-02-25",
  "adults": 2,
  "ages": [5, 8],
  "currency": "EUR",
  "search_mode": "SEARCH_BEST_DEAL",
  "canarian_resident": false,
  "balear_resident": false,
  "ceuta_melilla_resident": false
}
```

**Campos requeridos:** `origin`, `destination`, `departureDate`, `adults`, `currency`

**Endpoint MaarLab:** `GET /searchForFlightsToDestination/`

---

## 2. POST `/agencias/v1/vuelos/maarlab/paquete`

**Descripción:** Crea un paquete de vuelo usando la API de MaarLab Oceanflights.

**Método:** `POST`

**Query Parameters:**
- `info` (opcional, default: `'all'`): Nivel de detalle de la respuesta

**Body (CreatePackageDto):**
```json
{
  "flightId": "flight_123456",
  "currency": "EUR",
  "language": "es",
  "webhook": {
    "booking_url": "https://example.com/webhook/booking",
    "payment_url": "https://example.com/webhook/payment",
    "canceled_url": "https://example.com/webhook/canceled",
    "contracting_url": "https://example.com/webhook/contracting"
  }
}
```

**Campos requeridos:** `flightId`

**Endpoint MaarLab:** `POST /createPackage`

---

## 3. GET `/agencias/v1/vuelos/maarlab/equipaje`

**Descripción:** Obtiene información de equipaje disponible para un paquete previamente creado.

**Método:** `GET`

**Query Parameters:**
- `packageId` (requerido): ID del paquete obtenido después de su creación

**Ejemplo:**
```
GET /agencias/v1/vuelos/maarlab/equipaje?packageId=MAH-C7GQ0G
```

**Endpoint MaarLab:** `GET /getLuggage/`

---

## 4. POST `/agencias/v1/vuelos/maarlab/extras`

**Descripción:** Agrega extras seleccionados a un paquete de vuelo previamente creado.

**Método:** `POST`

**Query Parameters:**
- `packageId` (requerido): ID del paquete obtenido después de su creación
- `info` (opcional, default: `'all'`): Nivel de detalle de la respuesta

**Body (AddExtrasDto):**
```json
{
  "extras": {
    // Estructura de los extras según MaarLab API
  }
}
```

**Ejemplo:**
```
POST /agencias/v1/vuelos/maarlab/extras?packageId=MAH-C7GQ0G&info=all
```

**Endpoint MaarLab:** `POST /addExtras`

---

## 5. DELETE `/agencias/v1/vuelos/maarlab/extras`

**Descripción:** Elimina un extra específico de un paquete de vuelo.

**Método:** `DELETE`

**Query Parameters:**
- `packageId` (requerido): ID del paquete del cual se elimina el extra
- `itemId` (requerido): ID del item a eliminar (integer)
- `typeExtraId` (requerido): ID del tipo de extra a eliminar (integer)
- `info` (opcional, default: `'all'`): Nivel de detalle de la respuesta

**Ejemplo:**
```
DELETE /agencias/v1/vuelos/maarlab/extras?packageId=MAH-C7GQ0G&itemId=123&typeExtraId=1&info=all
```

**Endpoint MaarLab:** `DELETE /deleteExtras/`

---

## 6. POST `/agencias/v1/vuelos/maarlab/reservar`

**Descripción:** Reserva un paquete de vuelo agregando información de pasajeros y procediendo con la pre-reserva.

**Método:** `POST`

**Query Parameters:**
- `info` (opcional, default: `'all'`): Nivel de detalle de la respuesta

**Body (BookPackageDto):**
```json
{
  "packageId": "MAH-C7GQ0G",
  "hotel_id": "hotel123",
  "partner_id": "partner456",
  "passengers": [
    {
      "passengerId": "0",
      "type_passenger": "adult",
      "title": "Mr",
      "name": "Juan",
      "surname": "Pérez",
      "email": "juan@example.com",
      "contact_number": "+573001234567",
      "date_of_birth": "1990-01-15",
      "document_type": "PASSPORT",
      "document_number": "AB123456",
      "document_issuance": "COL",
      "document_expiration": "2030-01-15",
      "address": "Calle 123",
      "province": "Cundinamarca",
      "city": "Bogotá",
      "postalcode": "110111",
      "residence_type": "permanent",
      "residence": "Bogotá",
      "frequent_flyer_number": "123456789",
      "frequent_flyer_type": "AVIANCA"
    }
  ],
  "payment": {
    "payment_type": "ALL_NOW",
    "deferred_payment_date": "2026-05-01"
  }
}
```

**Campos requeridos:** `packageId`, `passengers` (array con al menos un pasajero)

**Endpoint MaarLab:** `POST /bookPackage/`

---

## 7. GET `/agencias/v1/vuelos/maarlab/token-pago`

**Descripción:** Obtiene el token de pago para un paquete específico.

**Método:** `GET`

**Query Parameters:**
- `packageId` (requerido): ID del paquete para obtener el token de pago
- `paymentType` (opcional): Tipo de pago (`FLIGHT_ONLY`, `ALL_NOW`, `FLIGHT_NOW_HOTEL_LATER`)
- `deferredPaymentDate` (opcional): Fecha de pago diferido (YYYY-MM-DD). Requiere `paymentType=FLIGHT_NOW_HOTEL_LATER`

**Ejemplo:**
```
GET /agencias/v1/vuelos/maarlab/token-pago?packageId=MAH-6AZS29&paymentType=FLIGHT_ONLY
GET /agencias/v1/vuelos/maarlab/token-pago?packageId=MAH-6AZS29&paymentType=FLIGHT_NOW_HOTEL_LATER&deferredPaymentDate=2025-12-13
```

**Endpoint MaarLab:** `GET /getTokenPayment/`

---

## 8. GET `/agencias/v1/vuelos/maarlab/paquete`

**Descripción:** Obtiene los detalles completos de un paquete específico usando su ID.

**Método:** `GET`

**Query Parameters:**
- `packageId` (requerido): ID del paquete a obtener
- `info` (opcional, default: `'all'`): Nivel de detalle de la respuesta

**Ejemplo:**
```
GET /agencias/v1/vuelos/maarlab/paquete?packageId=MAH-6AZS29&info=all
```

**Endpoint MaarLab:** `GET /getPackage`

---

## 9. GET `/agencias/v1/vuelos/maarlab/contrato-atol`

**Descripción:** Obtiene el contrato de factura ATOL para un paquete específico.

**Método:** `GET`

**Query Parameters:**
- `packageId` (requerido): ID del paquete para obtener el contrato ATOL

**Ejemplo:**
```
GET /agencias/v1/vuelos/maarlab/contrato-atol?packageId=MAH-6AZS29
```

**Endpoint MaarLab:** `GET /getInvoiceATOLContract`

---

## 10. POST `/agencias/v1/vuelos/maarlab/search-engine/complete-process`

**Descripción:** Crea hoteles con configuración por defecto. Si se proporciona `prefix_locator`, actualiza el hotel existente.

**Método:** `POST`

**Body (SearchEngineCompleteProcessDto):**
```json
{
  "name": "Hotel Example",
  "external_id": "HOTEL-001",
  "description": "Descripción corta del hotel",
  "id_chain_search_engine": "CHAIN-001",
  "direction": "Calle Principal 123",
  "phone": "+573001234567",
  "email": "hotel@example.com",
  "id_partner": "PARTNER-001",
  "clasification": 4,
  "currency_code": "COP",
  "post_code": "110111",
  "city": "Bogotá",
  "country": "Colombia",
  "website": "https://www.hotel.com",
  "hours_of_operation": "24/7",
  "cif": "123456789",
  "registered_company_name": "Hotel Example S.A.",
  "contact_center_type": "PROPIO",
  "account_manager_name": "Juan Pérez",
  "account_manager_email": "juan@example.com",
  "account_manager_phone": "+573001234567",
  "prefix_locator": "HOTEL"
}
```

**Campos requeridos:** Todos excepto `description`, `account_manager_phone`, `prefix_locator`

**Endpoint MaarLab:** `POST /search_engine/complete_process`

---

## 11. POST `/agencias/v1/vuelos/maarlab/travel-agency/complete-process`

**Descripción:** Crea agencias de viajes con configuración por defecto. Si se proporciona `prefix_locator`, actualiza la agencia existente.

**Método:** `POST`

**Body (TravelAgencyCompleteProcessDto):**
```json
{
  "name": "Agencia de Viajes Example",
  "external_id": "AGENCY-001",
  "description": "Descripción corta de la agencia",
  "id_chain_search_engine": "CHAIN-001",
  "direction": "Calle Principal 123",
  "phone": "+573001234567",
  "email": "agencia@example.com",
  "id_partner": "PARTNER-001",
  "clasification": 5,
  "currency_code": "COP",
  "post_code": "110111",
  "city": "Bogotá",
  "country": "Colombia",
  "website": "https://www.agencia.com",
  "hours_of_operation": "Lun-Vie 9:00-18:00",
  "cif": "123456789",
  "registered_company_name": "Agencia Example S.A.",
  "contact_center_type": "PROPIO",
  "account_manager_name": "Juan Pérez",
  "account_manager_email": "juan@example.com",
  "account_manager_phone": "+573001234567",
  "prefix_locator": "AGENCY"
}
```

**Campos requeridos:** Todos excepto `description`, `account_manager_phone`, `prefix_locator`

**Endpoint MaarLab:** `POST /travel_agency/complete_process`

---

## 12. GET `/agencias/v1/vuelos/maarlab/search-engine/mapping-external-id/:idSearchEngine`

**Descripción:** Obtiene el external ID de un hotel desde el ID interno de Oceanflight.

**Método:** `GET`

**Path Parameters:**
- `idSearchEngine` (requerido): ID interno del search engine (Oceanflight)

**Ejemplo:**
```
GET /agencias/v1/vuelos/maarlab/search-engine/mapping-external-id/b531d16c-07c1-4895-b4fe-3d27a0fa53c1
```

**Endpoint MaarLab:** `GET /api/v1/search_engine/mapping-external-id/{id_search_engine}/`

---

## 🔐 Autenticación

Todos los endpoints requieren:
- **Autenticación:** Bearer Token (JWT) del sistema
- **Variables de entorno requeridas:**
  - `MAARLAB_BASE_URL`: URL base de la API de MaarLab
  - `MAARLAB_AUTH_TOKEN`: Token de autenticación para MaarLab API

---

## 📝 Notas Generales

1. **Formato de fechas:** Todas las fechas deben estar en formato `YYYY-MM-DD`
2. **Manejo de errores:** Todos los endpoints manejan errores 400, 401, 404, 429, 500+
3. **Logging:** Todos los endpoints incluyen logging detallado con request IDs
4. **Timeout:** Todas las peticiones tienen un timeout de 30 segundos
5. **Validación:** Todos los DTOs incluyen validación completa con `class-validator`

---

## 🔄 Flujo Típico de Uso

1. **Buscar vuelos:** `POST /disponibilidad` → Obtener `flightId`
2. **Crear paquete:** `POST /paquete` → Obtener `packageId`
3. **Obtener equipaje (opcional):** `GET /equipaje?packageId=...`
4. **Agregar extras (opcional):** `POST /extras?packageId=...`
5. **Reservar paquete:** `POST /reservar` → Agregar información de pasajeros
6. **Obtener token de pago:** `GET /token-pago?packageId=...`
7. **Obtener detalles (opcional):** `GET /paquete?packageId=...`
8. **Obtener contrato ATOL (opcional):** `GET /contrato-atol?packageId=...`

---

**Última actualización:** 2026-01-19
