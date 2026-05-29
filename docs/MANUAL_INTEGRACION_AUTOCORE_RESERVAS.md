# Manual de integración — Creación de reservas (Autocore)

**Versión:** 1.2  
**Base URL:** `https://gehsuitesapps.com/agencias/v1/`  
**Alcance:** integración con la **API Agencias** para consultar disponibilidad de hoteles y crear reservas vía Autocore.

Este manual documenta **únicamente** los endpoints que su sistema debe consumir. No es necesario integrarse directamente con Autocore.

**Swagger:** `https://gehsuitesapps.com/agencias/v1/api-docs` (tag `reservas`)

---

## 1. Flujo de integración

Su aplicación debe ejecutar estos pasos en orden:

```mermaid
sequenceDiagram
    participant App as Su aplicación
    participant API as API Agencias

    App->>API: POST /auth/sign-in
    API-->>App: accessToken

    App->>API: POST /reservas/disponibilidad
    API-->>App: hoteles, habitaciones y tarifas

    Note over App: Usuario elige hotel, habitación y tarifa

    App->>API: POST /reservas/reservar?hotelId=...
    API-->>App: reservaChatbotId
```

| Paso | Endpoint | Resultado |
|------|----------|-----------|
| 0 | `POST /auth/sign-in` | Token JWT para autenticar el resto de llamadas |
| 1 | `POST /reservas/disponibilidad` | Ofertas de hoteles con precios y IDs de habitación/tarifa |
| 2 | `POST /reservas/reservar?hotelId=` | Reserva creada; recibe `reservaChatbotId` (localizador) |

---

## 2. Constantes de Autocore

Valores fijos que debe usar al armar las peticiones. Corresponden a la configuración del backend (`autocoreConstants` y validaciones del DTO).

### 2.1 Tipo de agencia (`category` / `agency_type`)

Define qué tarifas ve la agencia (minorista o mayorista).

| Valor numérico | Nombre | Uso en disponibilidad (`category`) | Uso en reserva (`agency.agency_type`) |
|----------------|--------|-------------------------------------|----------------------------------------|
| `0` | Minorista | Tarifa retailer | `"agency_type": 0` |
| `1` | Mayorista | Tarifa wholesale | `"agency_type": 1` |

- En **disponibilidad**, si omite `category`, se usa la categoría registrada de la agencia del usuario JWT.
- En **crear reserva**, `agency_type` debe coincidir con la categoría con la que cotizó la disponibilidad.

### 2.2 Ciudades (`ciudad` / `city`)

| Valor en API | Destino |
|--------------|---------|
| `CARTAGENA` | Cartagena |
| `SANTA_MARTA` | Santa Marta |
| `BOGOTA` | Bogotá |

- Disponibilidad: campo `ciudad`.
- Crear reserva: campo `reservaInfo.reservation.city`.
- Debe ser coherente con el hotel elegido (ver tabla de hoteles).

### 2.3 Hoteles (`hotelId`)

IDs válidos para el query `?hotelId=` al crear reserva:

| hotelId | Ciudad (API) | Nombre hotel |
|---------|--------------|--------------|
| `13645` | `CARTAGENA` | Hotel Azuan |
| `13633` | `CARTAGENA` | Hotel Aixo |
| `13644` | `CARTAGENA` | Hotel Avexi |
| `13643` | `CARTAGENA` | Hotel Marina |
| `14364` | `CARTAGENA` | Hotel Bocagrande |
| `17644` | `CARTAGENA` | Hotel Abi |
| `13677` | `CARTAGENA` | Hotel Boquilla |
| `18004` | `BOGOTA` | Hotel Windsor |
| `16255` | `BOGOTA` | Hotel Madisson |
| `17491` | `SANTA_MARTA` | Hotel Rodadero |
| `19629` | `SANTA_MARTA` | Hotel Axis |
| `15740` | `SANTA_MARTA` | Hotel Sansiraka |
| `21590` | `SANTA_MARTA` | Playa Salguero Hotel |

En la respuesta de disponibilidad, `hotel.id` es numérico (ej. `13645`); al reservar envíelo como **string** en el query: `?hotelId=13645`.

### 2.4 IDs internos de hotel (links de pago)

Referencia usada por el backend al generar links de cobro. No va en el body de crear reserva, pero el nombre del hotel debe coincidir:

| Nombre hotel | ID pago |
|--------------|---------|
| Hotel Azuan | `1` |
| Hotel Aixo | `4` |
| Hotel Avexi | `6` |
| Hotel Marina | `9` |
| Hotel Bocagrande | `7` |
| Hotel Abi | `5` |
| Hotel Boquilla | `56` |
| Hotel Windsor | `10` |
| Hotel Madisson | `3` |
| Hotel Rodadero | `8` |
| Hotel Axis | `48` |
| Hotel Sansiraka | `44` |
| Playa Salguero Hotel | `123` |

### 2.5 País y moneda

| Campo | Valor permitido |
|-------|-----------------|
| `reservation.country` | Solo `COL` |
| `reservation.currency` / `roomsData[].currency` | `COP` (único valor en disponibilidad) |

### 2.6 Tipos de documento

| Campo | Valores |
|-------|---------|
| `titularInfo.tipoDocumento` | `CC`, `NIT`, `CE`, `PA` |
| `asistentes[].tipoDocumento` | `CC`, `NIT`, `CE`, `PA` |

### 2.7 Tipos de habitación (respuesta de disponibilidad)

Valores posibles en `products[].roomType`:

| Valor | Descripción |
|-------|-------------|
| `DOUBLE` | Doble |
| `TRIPLE` | Triple |
| `QUADRUPLE` | Cuádruple |
| `FAMILY` | Familiar |

No se envían al crear reserva; sirven para mostrar la oferta al usuario.

### 2.8 Tipo de traslado (`infoTransporte.tipoRecogida`)

Solo si envía el bloque opcional `infoTransporte`:

| Valor | Significado |
|-------|-------------|
| `0` | Aeropuerto → hotel |
| `1` | Hotel → aeropuerto |
| `2` | Ida y vuelta (aeropuerto ↔ hotel) |

### 2.9 Reserva de grupo

| Condición | Efecto |
|-----------|--------|
| `roomsData.length >= 10` | Se considera reserva de grupo (reglas de pago y plazos distintos en el sistema) |

### 2.10 Formato de edades de menores

| Contexto | Formato |
|----------|---------|
| Disponibilidad → `layout[].children_ages` | **Array de números**: `[5, 8]` |
| Crear reserva → `reservation.children_ages` | **String** con edades separadas por coma: `"5,8"` o `""` si no hay menores |
| Crear reserva → `roomsData[].children_ages` | **String** por habitación: `"8"` o `""` |

---

## 3. Autenticación

Todas las rutas de este flujo requieren JWT.

### Obtener token

```http
POST /agencias/v1/auth/sign-in
Content-Type: application/json

{
  "email": "usuario@agencia.com",
  "password": "su_contraseña"
}
```

**Respuesta (200):**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

Use `accessToken` en todas las peticiones siguientes:

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json
```

| HTTP | Causa |
|------|--------|
| `401` | Credenciales incorrectas |
| `401` | Token ausente, expirado o inválido en pasos 1 y 2 |

---

## 4. Consultar disponibilidad

### Request

```http
POST /agencias/v1/reservas/disponibilidad
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Body:**

```json
{
  "checkingDate": "2026-06-10",
  "nights": 3,
  "ciudad": "CARTAGENA",
  "layout": [
    { "adults": 2, "children_ages": [8] }
  ],
  "category": 0
}
```

| Campo | Tipo | Req. | Descripción |
|-------|------|------|-------------|
| `checkingDate` | string | Sí | Fecha de entrada `YYYY-MM-DD` |
| `nights` | number | Sí | Número de noches (mínimo 1) |
| `ciudad` | string | Sí | `CARTAGENA`, `SANTA_MARTA` o `BOGOTA` |
| `layout` | array | Sí | Configuración por habitación a buscar |
| `layout[].adults` | number | Sí | Adultos en esa habitación (mínimo 1) |
| `layout[].children_ages` | number[] | No | Edades de los menores |
| `category` | 0 \| 1 | No | `0` = minorista, `1` = mayorista. Si no se envía, se usa la categoría de la agencia del usuario |

**Regla importante:** cada objeto en `layout` es **una habitación**. Para buscar 2 habitaciones dobles, envíe 2 elementos en el array.

### Respuesta (200)

Array de hoteles con disponibilidad. Estructura simplificada:

```json
[
  {
    "hotel": {
      "id": 13645,
      "name": "Hotel Azuan",
      "city": "Cartagena"
    },
    "availability": [
      {
        "adults": 2,
        "children_ages": "8",
        "available_rooms": [
          {
            "roomId": "12345",
            "roomName": "Habitación Doble Standard",
            "products": [
              {
                "roomId": "12345",
                "roomName": "Habitación Doble Standard",
                "rateId": "67890",
                "rateDescription": "Tarifa flexible",
                "currency": "COP",
                "baseRate": {
                  "amountAfterTax": 450000
                }
              }
            ]
          }
        ]
      }
    ]
  }
]
```

### Datos que debe extraer para crear la reserva

Cuando el usuario elija una opción, guarde estos valores:

| De la respuesta de disponibilidad | Se usa en crear reserva como |
|-----------------------------------|------------------------------|
| `hotel.id` | Query `hotelId` (ej. `13645`) |
| `available_rooms[].roomId` | `roomsData[].id` |
| `products[].rateId` | `roomsData[].rateId` |
| `products[].roomName` | `roomsData[].nombreHabitacion` |
| `products[].baseRate.amountAfterTax` | `roomsData[].unitaryPrice` |
| `products[].currency` | `roomsData[].currency` |
| `checkingDate` + `nights` | `checkin` y `checkout` |

**Checkout:** fecha de entrada + número de noches. Ejemplo: entrada `2026-06-10` + 3 noches → salida `2026-06-13`.

### Errores frecuentes

| HTTP | Causa |
|------|--------|
| `400` | Fecha inválida, ciudad no permitida o `layout` mal formado |
| `401` | Sin token o token inválido |
| `404` | Agencia del usuario no encontrada |
| `500` | Error al consultar disponibilidad |

---

## 5. Crear reserva

### 5.1 Request

```http
POST /agencias/v1/reservas/reservar?hotelId=13645
Authorization: Bearer {accessToken}
Content-Type: application/json
```

**Query parameter:**

| Parámetro | Descripción |
|-----------|-------------|
| `hotelId` | ID del hotel (string). Debe estar en la tabla de la sección [2.3](#23-hoteles-hotelid). |

### 5.2 Estructura del body (`CreateReservaDto`)

El body tiene **tres bloques principales** en la raíz. Varios campos numéricos van como **string** en `reservation` y `roomsData` (así lo exige la API).

```
CreateReservaDto
├── total                          (number)   — monto total de la reserva
├── titularInfo                    (object)   — datos del titular / facturación
├── reservaInfo                    (object)   — payload que se envía a Autocore
│   ├── agency                     (object)
│   │   ├── is_agency              (boolean)  — siempre true para agencias
│   │   ├── agency_type            (0 | 1)    — ver sección 2.1
│   │   └── external_ref_id        (string)   — referencia interna de su agencia
│   └── reservation                (object)
│       ├── adults                 (string)   — total adultos (suma de habitaciones)
│       ├── children               (string)   — total menores
│       ├── children_ages          (string)   — edades separadas por coma
│       ├── checkin / checkout     (string)   — YYYY-MM-DD
│       ├── nights                 (string)   — número de noches
│       ├── rooms                  (string)   — cantidad de habitaciones
│       ├── city, country, currency
│       ├── email, telephone
│       ├── firstName, lastName    — huésped principal
│       ├── notes                  (string)   — observaciones
│       └── roomsData[]            (array)    — detalle por habitación
│           ├── id                 (string)   — roomId de disponibilidad
│           ├── rateId             (string)   — rateId de disponibilidad
│           ├── nombreHabitacion   (string)
│           ├── adults, children, children_ages
│           ├── checkin, checkout, nights implícito
│           ├── currency           (string)   — COP
│           ├── quantity           (string)   — normalmente "1"
│           └── unitaryPrice       (number)   — precio unitario de la tarifa
├── notes                          (string, opcional) — se fusiona con reservation.notes
├── planAlimentario                (string, opcional)
├── asistentes[]                   (array, opcional)
├── infoTransporte                 (object, opcional)
├── infoToures                     (object, opcional)
├── reteFuente / reteIca / reteIva (object, opcional)
├── exentoIva, adicionCena, adicionAlmuerzo (boolean, opcional)
├── mascotas, mascotasNumber       (opcional)
└── origenIata                     (string, opcional)
```

### 5.3 Reglas para armar el body correctamente

1. **Coherencia con disponibilidad:** `roomsData[].id`, `roomsData[].rateId`, fechas y `unitaryPrice` deben salir de la respuesta del paso anterior para la misma búsqueda.
2. **Totales en `reservation`:** `adults`, `children` y `children_ages` son el **agregado** de todas las habitaciones.
   - Ejemplo 2 habitaciones (2 adultos + 2 adultos, 1 niño de 8 años): `adults: "4"`, `children: "1"`, `children_ages: "8"`.
3. **`rooms`:** string con el número de elementos en `roomsData` (ej. `"2"`).
4. **`nights`:** string; debe coincidir con la diferencia entre `checkin` y `checkout`.
5. **`city`:** enum de la sección 2.2; debe corresponder al hotel del `hotelId`.
6. **`agency.agency_type`:** mismo criterio que `category` usado en disponibilidad.
7. **`external_ref_id`:** identificador de su agencia o reserva interna (libre, string no vacío).
8. **`quantity`:** por habitación, normalmente `"1"` (una unidad de esa tarifa).
9. **`total`:** monto total acordado; típicamente suma de `unitaryPrice × quantity` por cada `roomsData`.
10. **Tipos mixtos:** en `reservation` casi todo es **string**; `unitaryPrice` y `total` son **number**.

### 5.4 Ejemplo — una habitación

```json
{
  "total": 1350000,
  "titularInfo": {
    "firstName": "María",
    "lastName": "Pérez",
    "tipoDocumento": "CC",
    "documento": "1023456789",
    "fechaNacimiento": "1990-05-12"
  },
  "reservaInfo": {
    "agency": {
      "is_agency": true,
      "agency_type": 1,
      "external_ref_id": "REF-001"
    },
    "reservation": {
      "adults": "2",
      "checkin": "2026-06-10",
      "checkout": "2026-06-13",
      "children": "1",
      "children_ages": "8",
      "city": "CARTAGENA",
      "country": "COL",
      "currency": "COP",
      "email": "maria.perez@agencia.com",
      "telephone": "+573001234567",
      "firstName": "María",
      "lastName": "Pérez",
      "nights": "3",
      "notes": "",
      "rooms": "1",
      "roomsData": [
        {
          "nombreHabitacion": "Habitación Doble Standard",
          "adults": "2",
          "children": "1",
          "children_ages": "8",
          "checkin": "2026-06-10",
          "checkout": "2026-06-13",
          "currency": "COP",
          "id": "12345",
          "quantity": "1",
          "rateId": "67890",
          "unitaryPrice": 450000
        }
      ]
    }
  }
}
```

> Los valores `id`, `rateId`, fechas y precios de `roomsData` deben coincidir con los obtenidos en el paso de disponibilidad.

### 5.5 Ejemplo — dos habitaciones

Disponibilidad consultada con `layout` de 2 entradas. Reserva en el mismo hotel:

```json
{
  "total": 2700000,
  "titularInfo": {
    "firstName": "Carlos",
    "lastName": "López",
    "tipoDocumento": "CC",
    "documento": "80123456",
    "fechaNacimiento": "1985-03-20"
  },
  "reservaInfo": {
    "agency": {
      "is_agency": true,
      "agency_type": 0,
      "external_ref_id": "PEDIDO-2026-0042"
    },
    "reservation": {
      "adults": "4",
      "children": "1",
      "children_ages": "8",
      "checkin": "2026-06-10",
      "checkout": "2026-06-13",
      "city": "CARTAGENA",
      "country": "COL",
      "currency": "COP",
      "email": "carlos@agencia.com",
      "telephone": "+573109876543",
      "firstName": "Carlos",
      "lastName": "López",
      "nights": "3",
      "notes": "Habitaciones contiguas si es posible",
      "rooms": "2",
      "roomsData": [
        {
          "nombreHabitacion": "Habitación Doble Standard",
          "adults": "2",
          "children": "1",
          "children_ages": "8",
          "checkin": "2026-06-10",
          "checkout": "2026-06-13",
          "currency": "COP",
          "id": "12345",
          "quantity": "1",
          "rateId": "67890",
          "unitaryPrice": 450000
        },
        {
          "nombreHabitacion": "Habitación Doble Standard",
          "adults": "2",
          "children": "0",
          "children_ages": "",
          "checkin": "2026-06-10",
          "checkout": "2026-06-13",
          "currency": "COP",
          "id": "12345",
          "quantity": "1",
          "rateId": "67890",
          "unitaryPrice": 450000
        }
      ]
    }
  }
}
```

Query: `POST .../reservas/reservar?hotelId=13645`

### 5.6 Tabla de campos (referencia rápida)

| Ruta | Tipo | Req. | Descripción |
|------|------|------|-------------|
| `total` | number | Sí | Monto total de la reserva |
| `titularInfo.firstName` | string | Sí | Nombre titular (3–50 caracteres) |
| `titularInfo.lastName` | string | Sí | Apellido titular |
| `titularInfo.tipoDocumento` | enum | Sí | Ver sección 2.6 |
| `titularInfo.documento` | string | Sí | Sin espacios ni puntos |
| `titularInfo.fechaNacimiento` | string | Sí | `YYYY-MM-DD` |
| `reservaInfo.agency.is_agency` | boolean | Sí | `true` |
| `reservaInfo.agency.agency_type` | 0 \| 1 | Sí | Ver sección 2.1 |
| `reservaInfo.agency.external_ref_id` | string | Sí | Referencia interna de la agencia |
| `reservation.adults` | string | Sí | Total adultos (suma habitaciones) |
| `reservation.children` | string | Sí | Total menores |
| `reservation.children_ages` | string | Sí | Edades separadas por coma o `""` |
| `reservation.checkin` | string | Sí | `YYYY-MM-DD` |
| `reservation.checkout` | string | Sí | `YYYY-MM-DD` |
| `reservation.nights` | string | Sí | Número de noches |
| `reservation.rooms` | string | Sí | Cantidad de habitaciones |
| `reservation.city` | enum | Sí | Ver sección 2.2 |
| `reservation.country` | string | Sí | `COL` |
| `reservation.currency` | string | Sí | `COP` |
| `reservation.email` | string | Sí | Email válido |
| `reservation.telephone` | string | Sí | 7–15 dígitos, opcional `+` |
| `reservation.firstName` | string | Sí | Nombre huésped principal |
| `reservation.lastName` | string | Sí | Apellido huésped principal |
| `reservation.notes` | string | No | Observaciones |
| `roomsData[].id` | string | Sí | `roomId` de disponibilidad |
| `roomsData[].rateId` | string | Sí | `rateId` de disponibilidad |
| `roomsData[].nombreHabitacion` | string | Sí | Nombre de la habitación |
| `roomsData[].adults` | string | Sí | Adultos en esta habitación |
| `roomsData[].children` | string | No | Menores en esta habitación |
| `roomsData[].children_ages` | string | No | Edades en esta habitación |
| `roomsData[].checkin` | string | Sí | Igual que reserva |
| `roomsData[].checkout` | string | Sí | Igual que reserva |
| `roomsData[].currency` | string | Sí | `COP` |
| `roomsData[].quantity` | string | Sí | Normalmente `"1"` |
| `roomsData[].unitaryPrice` | number | Sí | Precio de la tarifa elegida |

### 5.7 Bloques opcionales (estructura)

**`asistentes[]`** — cada elemento:

```json
{
  "fullName": "María García",
  "tipoDocumento": "CC",
  "documento": "0987654321",
  "telefono": "+573001234567",
  "email": "maria@ejemplo.com"
}
```

**`infoTransporte`:**

```json
{
  "numeroVuelo": "AV123",
  "numeroVueloSalida": "AV456",
  "aerolinea": "Avianca",
  "tipoRecogida": 1,
  "firstContactNumber": "+573001234567",
  "secondContacNumber": "+573009876543",
  "cantidadPersonas": 2
}
```

`tipoRecogida`: ver sección [2.8](#28-tipo-de-traslado-infotransportetiporecogida).

**`infoToures`:**

```json
{
  "nombres": ["Juan Pérez", "María García"],
  "firstContactNumber": "+573001234567",
  "secondContacNumber": "+573009876543"
}
```

**Retenciones** (`reteFuente`, `reteIca`, `reteIva`) — cada una:

```json
{
  "porcentaje": 2.5,
  "resultado": 33750
}
```

**Raíz opcional:**

| Campo | Tipo | Notas |
|-------|------|-------|
| `notes` | string | Máx. 8000 caracteres; se añade a `reservation.notes` |
| `planAlimentario` | string | Ej. `"Desayuno incluido"` |
| `mascotas` | boolean | |
| `mascotasNumber` | number | 0–50; `0` = sin mascotas |
| `exentoIva` | boolean | |
| `adicionCena` / `adicionAlmuerzo` | boolean | |
| `origenIata` | string | Código IATA origen (ej. `BOG`) |

### 5.8 Respuesta exitosa (200)

```json
{
  "reservaChatbotId": "CB88D9393D",
  "total": 1350000,
  "titularInfo": { "...": "..." },
  "reservaInfo": { "...": "..." }
}
```

| Campo | Descripción |
|-------|-------------|
| `reservaChatbotId` | **Localizador de la reserva.** Guárdelo en su sistema; es el identificador principal para consultas, pagos y cancelaciones posteriores. |

El resto de la respuesta es el mismo payload que envió, enriquecido con el localizador.

### 5.9 Errores frecuentes

| HTTP | Causa | Qué hacer |
|------|--------|-----------|
| `400` | `hotelId` no válido | Usar un ID de la sección [2.3](#23-hoteles-hotelid) |
| `400` | Body con campos inválidos | Revisar formato de fechas, teléfono, enums |
| `401` | Token inválido | Renovar con `/auth/sign-in` |
| `404` | Usuario sin agencia | Contactar soporte |
| `409` | Sin disponibilidad al confirmar | Volver a consultar disponibilidad y elegir otra tarifa/habitación |
| `500` | Error interno | Reintentar; si persiste, contactar soporte |

---

## 6. Ejemplo completo (cURL)

```bash
BASE="https://gehsuitesapps.com/agencias/v1"

# 1. Login
TOKEN=$(curl -s -X POST "$BASE/auth/sign-in" \
  -H "Content-Type: application/json" \
  -d '{"email":"usuario@agencia.com","password":"***"}' \
  | jq -r '.accessToken')

# 2. Disponibilidad
curl -s -X POST "$BASE/reservas/disponibilidad" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checkingDate": "2026-06-10",
    "nights": 3,
    "ciudad": "CARTAGENA",
    "layout": [{ "adults": 2, "children_ages": [] }]
  }'

# 3. Crear reserva (usar id/rateId reales de la respuesta anterior)
curl -s -X POST "$BASE/reservas/reservar?hotelId=13645" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "total": 1350000,
    "titularInfo": {
      "firstName": "María",
      "lastName": "Pérez",
      "tipoDocumento": "CC",
      "documento": "1023456789",
      "fechaNacimiento": "1990-05-12"
    },
    "reservaInfo": {
      "agency": {
        "is_agency": true,
        "agency_type": 1,
        "external_ref_id": "REF-001"
      },
      "reservation": {
        "adults": "2",
        "checkin": "2026-06-10",
        "checkout": "2026-06-13",
        "children": "0",
        "children_ages": "",
        "city": "CARTAGENA",
        "country": "COL",
        "currency": "COP",
        "email": "maria@agencia.com",
        "telephone": "+573001234567",
        "firstName": "María",
        "lastName": "Pérez",
        "nights": "3",
        "notes": "",
        "rooms": "1",
        "roomsData": [{
          "nombreHabitacion": "Habitación Doble Standard",
          "adults": "2",
          "children": "0",
          "children_ages": "",
          "checkin": "2026-06-10",
          "checkout": "2026-06-13",
          "currency": "COP",
          "id": "12345",
          "quantity": "1",
          "rateId": "67890",
          "unitaryPrice": 450000
        }]
      }
    }
  }'
```

---

## 7. Checklist para el integrador

- [ ] Obtener credenciales de usuario de agencia en la plataforma
- [ ] Implementar login y almacenar `accessToken`
- [ ] Llamar disponibilidad con el `layout` correcto (1 entrada = 1 habitación)
- [ ] Mostrar opciones al usuario y capturar `hotelId`, `roomId`, `rateId` y precio
- [ ] Armar el body según sección [5.2](#52-estructura-del-body-createreservadto) y constantes de la sección 2
- [ ] Verificar totales `adults` / `children` agregados y `rooms` = cantidad de `roomsData`
- [ ] Guardar `reservaChatbotId` de la respuesta
- [ ] Manejar `409` re-consultando disponibilidad si la habitación ya no está libre

---

## 8. Consultar reservas creadas (opcional)

Después de crear la reserva, puede listar las reservas del usuario autenticado:

```http
GET /agencias/v1/reservas/reservas-by-user?page=1
Authorization: Bearer {accessToken}
```

Los administradores de agencia pueden usar:

```http
GET /agencias/v1/reservas/reservas-by-agencia?page=1
Authorization: Bearer {accessToken}
```

(Requiere rol `admin`.)
