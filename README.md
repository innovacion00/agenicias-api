# Agencias API

Backend NestJS para la plataforma de reservas de **Geh Suites**. Centraliza la gestión de agencias de viajes, reservas hoteleras (Autocore y My Tool), vuelos (Amadeus y MaarLab/OceanFlights), cotizaciones, pagos (Cobre), notificaciones automáticas y procesos internos.

**Base URL:** `{host}/agencias/v1/`  
**Swagger:** `{host}/agencias/v1/api-docs`

---

## Índice

1. [Stack y dependencias](#1-stack-y-dependencias)
2. [Estructura del proyecto](#2-estructura-del-proyecto)
3. [Variables de entorno](#3-variables-de-entorno)
4. [Instalación y scripts](#4-instalación-y-scripts)
5. [Autenticación y autorización](#5-autenticación-y-autorización)
6. [Estados de reserva](#6-estados-de-reserva)
7. [Módulos y responsabilidades](#7-módulos-y-responsabilidades)
8. [Flujos de negocio](#8-flujos-de-negocio)
9. [Endpoints HTTP](#9-endpoints-http)
10. [Webhook de pagos (Autocore)](#10-webhook-de-pagos-autocore)
11. [Cancelación automática de reservas](#11-cancelación-automática-de-reservas)
12. [Bot de reservas pendientes](#12-bot-de-reservas-pendientes)
13. [Paginación](#13-paginación)
14. [Seguridad, logging y rate limiting](#14-seguridad-logging-y-rate-limiting)
15. [Notas técnicas](#15-notas-técnicas)

---

## 1. Stack y dependencias

| Componente | Versión |
|---|---|
| Node.js | 20+ recomendado |
| NestJS | ^10.0.0 |
| TypeScript | ^5.1.x |
| MongoDB + Mongoose | ^8.6.x |
| Validación | class-validator, class-transformer |
| Auth | passport-jwt, bcrypt, @nestjs/jwt |
| HTTP cliente | axios, @nestjs/axios |
| Docs | @nestjs/swagger ^7.4.x |
| Rate limiting | @nestjs/throttler ^6.5.x |
| Logs | nestjs-pino, pino-http, pino-pretty |
| Tareas programadas | @nestjs/schedule |
| Email | Nodemailer (Gmail API), SendGrid |
| Otros | Puppeteer, ExcelJS, Cloudinary, date-fns, slugify, uuid |

---

## 2. Estructura del proyecto

```
src/
├── agencias/                 # CRUD agencias, saldo, políticas
├── auth/                     # JWT, OTP, refresh tokens, usuarios
├── booking-personas/         # Flujo reserva con token estático
├── bot-reservas-pendientes/  # Bot diario de pagos pendientes
├── cloudinary/               # Servicio de imágenes (interno)
├── common/                   # HttpCustomService, SendEmailCustomService, helpers, pipes
├── config/                   # Envs (Joi), constantes (Autocore, MyTool, plantillas email)
├── cotizaciones/             # CRUD cotizaciones + módulo público
├── eventos/                  # Gestión de convenciones/eventos
├── files/                    # Subida de archivos (perfil usuario)
├── integrations/             # Integraciones por API Key
├── maarlab-credentials/      # Credenciales partner MaarLab por agencia
├── my-tool/                  # Herramienta interna de consulta de reservas
├── notificaciones/           # Notificaciones de pago y cancelación automática
├── referencia-aeropuertos/   # Catálogo de aeropuertos (seed + búsqueda)
├── reservas/                 # Núcleo: Autocore + My Tool + pagos + cancelación
├── vuelos/                   # Amadeus (GDS) + MaarLab/OceanFlights
├── app.module.ts
└── main.ts                   # Prefijo global, CORS, ValidationPipe, Swagger
```

---

## 3. Variables de entorno

Definidas y validadas con **Joi** en `src/config/envs.ts`. El archivo `.env` debe tener como mínimo las siguientes variables:

| Variable | Descripción |
|---|---|
| `PORT` | Puerto HTTP del servidor |
| `MONGO_URL` | Cadena de conexión MongoDB |
| `JWT_SECRET` | Secreto de firma JWT |
| `COBRE_*` (5 vars) | Credenciales Cobre (links de pago) |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | Cloudinary |
| `SENDER_EMAIL`, `EMAIL_APP_PASSWORD` | Nodemailer / Gmail |
| `SENDGRID_API_KEY` | SendGrid |
| `GOOGLE_GMAIL_*` (5 vars) | Gmail API OAuth |
| `AUTOCORE_URL`, `AUTOCORE_ACCESS_KEY`, `AUTOCORE_SECRET_KEY` | Autocore producción |
| `AUTOCORE_URL_DEV`, `AUTOCORE_ACCESS_KEY_DEV`, `AUTOCORE_SECRET_KEY_DEV` | Autocore dev (opcional) |
| `MY_TOOL_EMAIL`, `MY_TOOL_CLAVE` | Credenciales My Tool |
| `API_AIXO`, `API_AZUAN`, `API_RODADERO`, `API_AVEXI`, `API_BOCAGRANADE`, `API_ABI`, `API_MADISSON`, `API_WINDSOR`, `API_MARINA`, `API_AXIS`, `API_MARQUES`, `API_SANSIRAKA`, `API_PLAYASALGUERO` | URL base por hotel My Tool |
| `AMADEUS_API_KEY`, `AMADEUS_API_SECRET`, `AMADEUS_BASE_URL` | Amadeus GDS |
| `BOOKING_PERSONAS_TOKEN` | Token estático para el flujo de booking personas |
| `MAARLAB_BASE_URL` | URL base MaarLab/OceanFlights |
| `MAARLAB_AUTH_TOKEN` | Token MaarLab legado (opcional, puede estar vacío) |
| `MAARLAB_PARTNER_SYNC_BEARER` | Bearer para script de sync de credenciales (opcional) |
| `MAARLAB_CHAIN_SEARCH_ENGINE_ID` | Chain ID para script de sync (opcional) |

> `.unknown(true)` en Joi permite variables adicionales sin romper el arranque.

---

## 4. Instalación y scripts

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con los valores reales

# Desarrollo con hot-reload
npm run start:dev

# Producción
npm run build
npm run start:prod
```

### Scripts disponibles

| Script | Descripción |
|---|---|
| `npm run start:dev` | Servidor de desarrollo con watch |
| `npm run build` | Compilar a dist/ |
| `npm run start:prod` | Ejecutar desde dist/ |
| `npm run test` | Pruebas unitarias (Jest) |
| `npm run test:e2e` | Pruebas end-to-end |
| `npm run test:cov` | Cobertura de pruebas |
| `npm run seed:airports` | Cargar catálogo de aeropuertos en MongoDB |
| `npm run seed:airports:indexes` | Solo crear índices de aeropuertos |
| `npm run sync:maarlab-keys` | Sincronizar credenciales de partner MaarLab |
| `npm run migrate:maarlab-api-key` | Migración legado de API keys MaarLab |
| `npm run migrate:abono` | Migración del campo abono en reservas |
| `npm run script:register-agencias-maarlab` | Registrar agencias en MaarLab |
| `npm run script:list-agencias-sin-maarlab` | Diagnosticar agencias sin credenciales MaarLab |

**Health check rápido:** `GET /agencias/v1/vuelos/test`

---

## 5. Autenticación y autorización

### Roles de usuario (`ValidRoles`)
- `admin`
- `user`
- `super-admin`
- `eventos-super-admin`

### JWT (usuarios)

- **Header:** `Authorization: Bearer <accessToken>`
- **Access token:** expira en **60 minutos**
- **Refresh token:** hex de 64 bytes, almacenado en MongoDB, válido **7 días**

**Login / validar OTP — respuesta:**
```json
{
  "accessToken": "eyJ...",
  "refreshToken": "a1b2c3d4...",
  "expiresIn": "15m",
  "_id": "...",
  "email": "...",
  "fullName": "...",
  "role": ["user"],
  "agencia": {}
}
```

> ⚠️ El campo `expiresIn` en la respuesta devuelve `"15m"` como referencia informativa. El token JWT real expira en **60 minutos**. Para calcular expiración, decodificar el claim `exp` del JWT.

**Renovar token:**
```http
POST /agencias/v1/auth/refresh-token
Content-Type: application/json

{ "token": "<refreshToken>" }
```

**OTP:**
- Código numérico de **5 dígitos** (10000–99999)
- Validar con `POST /auth/validate-otp` → body `{ "email": "...", "otp": "12345" }`

### Booking personas (token estático)

- Header preferente: `x-booking-token: <BOOKING_PERSONAS_TOKEN>`
- Alternativa: `Authorization: Bearer <BOOKING_PERSONAS_TOKEN>`

### Integraciones (API Key)

- Decorador `@ApiKeyProtected()` en rutas de integración.

### Decoradores frecuentes

- `@Auth(...roles)` — JWT con validación de roles
- `@GetUser()` — extrae el usuario del request
- `@ApiKeyProtected()` — protección por API Key
- `@StaticTokenAuth()` — token estático de booking personas

---

## 6. Estados de reserva

El campo `status` de una reserva es un número entero con los siguientes valores:

| Valor | Nombre | Descripción |
|---|---|---|
| `0` | `espera` | Pendiente de pago (recién creada) |
| `1` | `proceso` | Comprobante de pago enviado, en revisión |
| `2` | `rejected` | Pago rechazado |
| `3` | `total` | Pago completo aprobado |
| `4` | `cancelado` | Reserva cancelada |
| `5` | `mitad` | Primera mitad pagada, pendiente segunda mitad |
| `6` | `reservaAbonada` | Reserva con abono parcial externo |

El campo `pagadoPrimeraMitad: boolean` acompaña al status para distinguir si ya se realizó el primer abono.

---

## 7. Módulos y responsabilidades

### Auth
Login, registro, OTP (omisión configurable con `settings.omitirOtp`), refresh token, cambio de credenciales, políticas de agencia, listados admin. JWT configurado con `expiresIn: '60m'`.

### Reservas
- Disponibilidad y reserva vía **Autocore**
- Reserva vía **My Tool** (con fallback a Autocore si My Tool falla y el hotel tiene `autocoreId` configurado)
- Webhooks de pago Cobre/Autocore, generación de links, pagos con billetera
- Cancelación con permisos por rol, locks de cancelación distribuidos
- Reprocesamiento manual de webhooks (superAdmin)
- Actualización de comprobantes de pago, abonos y fechas límite

**Hoteles My Tool disponibles:** `aixo`, `azuan`, `avexi`, `marina`, `bocagrande`, `abi`, `boquilla`, `madisson`, `windsor`, `rodadero`, `axis`, `marques`, `sansiraka`, `playasalguero`

### Notificaciones
- **Cron cada hora:** cancela reservas con `pagadoPrimeraMitad: false` cuya `fechaLimitePago` ya venció.
- **Política de segunda mitad:** si `pagadoPrimeraMitad: true`, la reserva **NO se cancela** automáticamente aunque venza `fechaLimitePago2`. Solo se envían avisos al cliente; la decisión de cancelar se toma manualmente.
- Envía notificaciones por correo a la agencia cuando una fecha límite está próxima (7 días, 3–1 días, último día).

### Cotizaciones
CRUD autenticado, estadísticas, generación de PDF (Puppeteer), conversión a reserva, landing pública por token de acceso.

### Vuelos
- **Amadeus (GDS):** búsqueda de vuelos, ubicaciones, ciudades, aeropuertos, reservas, cancelaciones. La mayoría de rutas sin JWT.
- **MaarLab/OceanFlights:** todas las rutas con JWT. El backend resuelve el Bearer de MaarLab por agencia.

### Agencias
Alta de agencias, recarga de saldo, listados, activación/desactivación, políticas, integración con credenciales MaarLab.

### MaarLab Credentials
Colección `MaarlabPartnerCredential`. Resolución de Bearer para MaarLab en orden: (1) credencial vinculada a `agenciaId`, (2) `hotelName` coincide exactamente con `Agencia.fullName`, (3) campo legado `maarlabApiKey` en la agencia.

Sincronizar con: `npm run sync:maarlab-keys`

### Booking Personas
Flujo con token estático para reservas directas: disponibilidad, link de pago, creación de reserva, webhook de confirmación de pago.

### Bot de reservas pendientes
Ver sección [12. Bot de reservas pendientes](#12-bot-de-reservas-pendientes).

### Referencia de aeropuertos
Catálogo local en MongoDB. Seed con `npm run seed:airports`. Búsqueda predictiva por IATA, nombre o ciudad.

### Otros
- **Files:** subida de foto de perfil (multipart, JWT)
- **Eventos:** convenciones y eventos corporativos
- **Integrations:** alta de integraciones externas con API Key para acceder a disponibilidad
- **My-tool (módulo):** consulta interna de información de reservas (sin JWT en controlador; proteger con WAF/IP allowlist)
- **Cloudinary:** servicio interno de imágenes (sin rutas HTTP propias)

---

## 8. Flujos de negocio

### 8.1 Reserva Autocore

```
1. POST /reservas/disponibilidad          (JWT)
2. POST /reservas/reservar?hotelId=...    (JWT)
3. POST /reservas/generate-link           (JWT) → link de pago Cobre
4. POST /reservas/change-status           (Webhook Autocore → pago confirmado)
```

### 8.2 Reserva My Tool

```
1. GET  /reservas/mytool/:hotelSlug/mappings   (JWT, opcional)
2. POST /reservas/mytool/:hotelSlug             (JWT)
   → Fallback automático a Autocore si My Tool falla y hay autocoreId configurado
3. POST /reservas/mytool/cancelar               (JWT)
```

**Campos especiales del body de reserva My Tool:**
- `bookData.localizador`: el servidor lo **sobrescribe** con un ID generado internamente (formato `CB + 8 hex`)
- `notes` (raíz del body): se guarda solo en MongoDB (`reservation.notes`), **no** se envía a My Tool
- `rooms[].nombreHabitacion` y `rooms[].room_id`: se persisten en `roomsData`, **no** se reenvían a My Tool
- `mascotasNumber` (0–50): solo MongoDB; `> 0` activa `reserva.mascotas = true`

### 8.3 Cotización pública

```
1. POST /cotizaciones                              (JWT, agencia crea)
2. GET  /cotizaciones/public/token/:tokenAcceso    (público, cliente ve)
3. POST /cotizaciones/public/responder/:tokenAcceso (público, cliente responde)
4. POST /cotizaciones/convertir-reserva/:id        (JWT, conversión manual/automática)
```

### 8.4 Vuelos MaarLab

```
1. POST /vuelos/maarlab/disponibilidad          (JWT) → flightId
2. POST /vuelos/maarlab/paquete                 (JWT) → packageId
3. GET  /vuelos/maarlab/equipaje?packageId=...  (JWT, opcional)
4. POST /vuelos/maarlab/extras?packageId=...    (JWT, opcional)
5. POST /vuelos/maarlab/reservar                (JWT) → datos de pasajeros
6. GET  /vuelos/maarlab/token-pago?packageId=.. (JWT) → token de pago
```

### 8.5 Conciliación bancaria (Agente IA)

Para actualizar el estado de pago de una reserva conciliada externamente (ej: agente de IA bancario), usar el webhook de cambio de estado:

```http
POST /agencias/v1/reservas/change-status
Content-Type: application/json

{
  "external_ref_id": "<MongoDB _id de la reserva>",
  "payment_status": "aplicado",
  "transaction_id": "BANCO-REF-UNICA-12345",
  "details": {
    "id": "BANCO-REF-UNICA-12345",
    "pay_platform": "conciliacion_bancaria"
  }
}
```

- **Primera mitad:** `external_ref_id` = solo el `_id`
- **Pago total:** `external_ref_id` = `"<_id> pagoTotal"` (espacio + la palabra `pagoTotal`)
- `transaction_id` actúa como llave de idempotencia (evita duplicar el mismo pago)

Ver sección [10. Webhook de pagos](#10-webhook-de-pagos-autocore) para detalles completos.

---

## 9. Endpoints HTTP

Prefijo global: `/agencias/v1`

### Auth — `/auth`

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/auth/sign-up/:id` | No | Throttle 3/min |
| POST | `/auth/register-user` | JWT admin/superAdmin | |
| POST | `/auth/sign-in` | No | Throttle 5/min |
| POST | `/auth/validar-token` | No | |
| POST | `/auth/validate-access-token` | No | |
| POST | `/auth/refresh-token` | No | Throttle 10/min |
| POST | `/auth/validate-otp` | No | Throttle 5/min |
| POST | `/auth/request-password-change` | No | Throttle 3/min |
| PATCH | `/auth/new-credentials` | JWT | |
| PATCH | `/auth/switch-activation-status/:userId` | JWT admin/superAdmin | |
| GET | `/auth/getAllUsers` | JWT superAdmin | |
| PATCH | `/auth/politicas-agencia` | JWT | |
| PATCH | `/auth/encuesta` | JWT | |

### Reservas — `/reservas`

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/reservas/reservar` | JWT | Query `?hotelId=` |
| PUT | `/reservas/editar-reserva/:reservaId` | JWT | |
| DELETE | `/reservas/cancelar-reserva` | JWT | |
| POST | `/reservas/change-status` | No | Webhook Autocore/banco |
| POST | `/reservas/reprocess-webhook/:reservaId` | JWT superAdmin | Reprocesar webhook manualmente |
| GET | `/reservas/reservas-by-user` | JWT | |
| GET | `/reservas/reservas-by-agencia` | JWT admin | |
| POST | `/reservas/generate-link` | JWT | |
| POST | `/reservas/reactivar` | JWT | Reactivar reserva cancelada |
| POST | `/reservas/pago-billetera-single` | JWT | |
| POST | `/reservas/pago-billetera-compuesto` | JWT | |
| POST | `/reservas/disponibilidad` | JWT | |
| POST | `/reservas/disponibilidad-debug` | JWT | |
| GET | `/reservas/buscar/chatbot-id` | JWT | Query |
| GET | `/reservas/buscar/agente` | JWT | |
| GET | `/reservas/buscar/agencia` | JWT | |
| GET | `/reservas/buscar/huesped` | JWT | |
| GET | `/reservas/buscar/estado` | JWT | |
| GET | `/reservas` | JWT superAdmin | Paginación + filtros |
| DELETE | `/reservas/cancelar-reserva-admin/:reservaId` | JWT superAdmin | |
| PUT | `/reservas/status/:reservaId` | JWT superAdmin | Actualizar status manual |
| PUT | `/reservas/fechas-pago/:reservaId` | JWT admin/superAdmin | |
| PUT | `/reservas/abono/:reservaChatbotId` | JWT superAdmin | Registrar abono externo |
| POST | `/reservas/comprobante-enviado/:reservaId` | JWT | Registrar comprobante Bitrix |
| POST | `/reservas/mytool/cancelar` | JWT | |
| GET | `/reservas/mytool/:hotelSlug/mappings` | JWT | |
| GET | `/reservas/mytool/:hotelSlug/buscar` | JWT | Query: localizador, nombre |
| POST | `/reservas/mytool/:hotelSlug` | JWT | Crear + fallback Autocore |

### Cotizaciones — `/cotizaciones`

| Método | Ruta | Auth | Notas |
|---|---|---|---|
| POST | `/cotizaciones` | JWT | |
| GET | `/cotizaciones` | JWT | `?page=&limit=` |
| GET | `/cotizaciones/estadisticas` | JWT | |
| GET | `/cotizaciones/:id` | JWT | |
| POST | `/cotizaciones/from-disponibilidad` | JWT | |
| POST | `/cotizaciones/responder/:tokenAcceso` | JWT | |
| POST | `/cotizaciones/pdf` | JWT | |
| POST | `/cotizaciones/convertir-reserva/:id` | JWT | |
| PATCH | `/cotizaciones/:id` | JWT | |
| DELETE | `/cotizaciones/:id` | JWT | |
| GET | `/cotizaciones/public/token/:tokenAcceso` | No | |
| GET | `/cotizaciones/public/:id` | No | |
| POST | `/cotizaciones/public/responder/:tokenAcceso` | No | |

### Vuelos — `/vuelos`

**Amadeus / general (sin JWT):**

| Método | Ruta |
|---|---|
| GET | `/vuelos/test` |
| GET | `/vuelos/ubicaciones` |
| GET | `/vuelos/aeropuertos/iata/:iataCode` |
| GET | `/vuelos/ciudades` |
| GET | `/vuelos/ciudades/buscar` |
| POST | `/vuelos/disponibilidad` |
| POST | `/vuelos/disponibilidad-test` |
| POST | `/vuelos/reservar` |
| GET | `/vuelos/reservas/:flightOrderId` |
| DELETE | `/vuelos/reservas/:flightOrderId` |

**MaarLab — todos requieren JWT:**

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/vuelos/maarlab/disponibilidad` | Buscar vuelos |
| POST | `/vuelos/maarlab/paquete` | Crear paquete |
| GET | `/vuelos/maarlab/equipaje` | Info de equipaje (`?packageId=`) |
| POST | `/vuelos/maarlab/extras` | Agregar extras |
| DELETE | `/vuelos/maarlab/extras` | Eliminar extra |
| POST | `/vuelos/maarlab/reservar` | Reservar con pasajeros |
| GET | `/vuelos/maarlab/token-pago` | Token de pago (`?packageId=`) |
| GET | `/vuelos/maarlab/paquete` | Detalles del paquete |
| GET | `/vuelos/maarlab/contrato-atol` | Contrato ATOL |
| POST | `/vuelos/maarlab/search-engine/complete-process` | Crear hotel en MaarLab |
| POST | `/vuelos/maarlab/travel-agency/complete-process` | Crear agencia en MaarLab |
| POST | `/vuelos/maarlab/v1/travel-agency/complete-process` | Versión v1 |
| GET | `/vuelos/maarlab/search-engine/mapping-external-id/:id` | Mapear ID externo |

**Webhooks MaarLab (sin JWT):**

| Método | Ruta |
|---|---|
| POST | `/vuelos/maarlab-webhook/booking` |
| POST | `/vuelos/maarlab-webhook/payment` |
| POST | `/vuelos/maarlab-webhook/canceled` |
| POST | `/vuelos/maarlab-webhook/contracting` |

### Agencias — `/agencias`

| Método | Ruta | Auth |
|---|---|---|
| POST | `/agencias/create` | No |
| POST | `/agencias/recharge-wallet` | JWT |
| GET | `/agencias/obtener-saldo` | JWT |
| GET | `/agencias` | JWT superAdmin |
| GET | `/agencias/getByProperty` | JWT superAdmin |
| PATCH | `/agencias/update/:id` | JWT superAdmin |
| PATCH | `/agencias/switch-activation-agencia/:agenciaId` | JWT superAdmin |
| GET | `/agencias/agencies-by-term` | No |
| GET | `/agencias/agencias-con-reserva` | JWT superAdmin |
| GET | `/agencias/:id/politicas` | JWT |
| GET | `/agencias/:agenciaId/nombre` | JWT |

### Booking Personas — `/booking-personas`

| Método | Ruta | Auth |
|---|---|---|
| POST | `/booking-personas/disponibilidad` | Token estático |
| POST | `/booking-personas/generar-link-pago` | Token estático |
| POST | `/booking-personas/reservar` | Token estático |
| POST | `/booking-personas/change-status` | No (webhook) |

### Referencia aeropuertos — `/referencia-aeropuertos`

| Método | Ruta | Auth |
|---|---|---|
| GET | `/referencia-aeropuertos/sugerencias` | JWT |
| GET | `/referencia-aeropuertos/estado` | JWT |

### Integraciones — `/integrations`

| Método | Ruta | Auth |
|---|---|---|
| POST | `/integrations/create` | No |
| POST | `/integrations/disponibilidad` | API Key |
| POST | `/integrations/chat` | API Key |

### Bot — `/bot-reservas-pendientes`

| Método | Ruta | Auth |
|---|---|---|
| POST | `/bot-reservas-pendientes/ejecutar-manualmente` | JWT superAdmin |
| POST | `/bot-reservas-pendientes/estado` | JWT superAdmin |
| POST | `/bot-reservas-pendientes/diagnostico` | JWT superAdmin |

### Notificaciones — `/notificaciones`

| Método | Ruta | Auth |
|---|---|---|
| POST | `/notificaciones/reservas` | No |

### Eventos — `/eventos`

| Método | Ruta | Auth |
|---|---|---|
| POST | `/eventos/create` | JWT |
| GET | `/eventos` | JWT superAdmin / eventos-super-admin |

### Files — `/files`

| Método | Ruta | Auth |
|---|---|---|
| POST | `/files/user-profile` | JWT (multipart) |

### My Tool interno — `/my-tool`

| Método | Ruta | Auth |
|---|---|---|
| GET | `/my-tool/reservas-info` | Sin guard (proteger con WAF/IP) |

---

## 10. Webhook de pagos (Autocore)

`POST /agencias/v1/reservas/change-status` — sin JWT, sin throttle.

### Payload

```json
{
  "external_ref_id": "<_id MongoDB de la reserva>",
  "payment_status": "aplicado",
  "transaction_id": "REF-UNICA-BANCO-001",
  "details": {
    "id": "REF-UNICA-BANCO-001",
    "pay_platform": "autocore"
  }
}
```

### Valores de `payment_status`

| Intención | Valores aceptados (case insensitive, sin acentos) |
|---|---|
| ✅ Pago exitoso | `aplicado`, `aplicada`, `aprobado`, `aprobada`, `approved`, `paid`, `success`, `successful`, `completed`, `complete`, `confirmed`, `ok` |
| ❌ Pago rechazado | `rechazado`, `rechazada`, `cancelado`, `cancelada`, `rejected`, `declined`, `failed`, `error`, `canceled`, `cancelled`, `denegado`, `denegada`, `tarjeta no valida` |
| ⏳ En proceso | `en proceso`, `en_proceso`, `proceso`, `pendiente`, `pending`, `processing`, `in process`, `in_process` |

### Lógica de `external_ref_id`

- `"<_id>"` → pago de **primera mitad** → status pasa a `5 (mitad)`, `pagadoPrimeraMitad: true`
- `"<_id> pagoTotal"` → **pago total único** → status pasa a `3 (total)`, `pagadoPrimeraMitad: true`
- Si `pagadoPrimeraMitad` ya es `true` y llega otro pago aplicado → **segunda mitad** → status pasa a `3 (total)`

### Idempotencia

El campo `transaction_id` (o `details.id`) se guarda como clave `"<id>:<statusNorm>"` en el array `paymenIds` de la reserva. Si el mismo evento llega dos veces, el segundo se ignora silenciosamente.

---

## 11. Cancelación automática de reservas

### Proceso automático (cada hora)

`@Cron(CronExpression.EVERY_HOUR)` en `NotificacionesService.cancelarReservasVencidasAutomatico()`

**Se cancela cuando:**
- `pagadoPrimeraMitad: false` Y `fechaLimitePago` ya venció → cancela en Autocore y actualiza a `status: 4`

**NO se cancela cuando:**
- `pagadoPrimeraMitad: true` → aunque `fechaLimitePago2` haya vencido, la reserva **no se cancela automáticamente**. Solo se envían notificaciones. La decisión se toma manualmente.

### Notificaciones de aviso al cliente

`notificacionPago()` envía correos a la agencia/usuario según los días restantes a la fecha límite de pago:

| Días restantes | Tipo de aviso |
|---|---|
| 7 días | Recordatorio anticipado |
| 1–3 días | Aviso urgente |
| 0 días (horas < 0) | Último aviso |
| < 0 días | Vencida → cancela (solo si `pagadoPrimeraMitad: false`) |

### Cálculo de fechas límite

`calcularFechaLimitePago(fechaCheckin, isReservaGrupo, agenciaId)` devuelve `fechaLimitePago` y `fechaLimitePago2`:

| Días hasta check-in | `fechaLimitePago` (primera mitad) | `fechaLimitePago2` (segunda mitad) |
|---|---|---|
| ≤ 3 días | Hoy | 1 día antes del check-in |
| 4–10 días | `hoy + (días - 2)` | 1 día antes del check-in |
| 11–30 días | `hoy + (días - 7)` | 1 día antes del check-in |
| 31–59 días | `hoy + (días - 12)` | 1 día antes del check-in |
| ≥ 60 días (individual) | `hoy + días × 50%` | `hoy + días × 60%` |
| ≥ 60 días (grupo) | `hoy + días × 10%` | `hoy + días × 30%` |
| Agencia especial | 3 días antes check-in | 3 días antes check-in |

---

## 12. Bot de reservas pendientes

`@Cron(CronExpression.EVERY_DAY_AT_8AM)` en `BotReservasPendientesService`

**Función:** Cada mañana a las 8:00 AM identifica reservas con pagos próximos a vencer (≤ 2 días) y envía un reporte al equipo interno.

**Criterios de filtrado:**
- `status: 0` (espera) + `pagadoPrimeraMitad: false` → `fechaLimitePago` ≤ 2 días
- `status: 5` (mitad) + `pagadoPrimeraMitad: true` → `fechaLimitePago2` ≤ 2 días

**Reporte:**
- **Destinatario:** `reservas@gehsuites.com`
- **Asunto:** "Reservas Pendientes de Pago - Reporte Diario"
- **Adjunto:** Excel con 25 columnas, filas críticas (≤ 1 día) resaltadas en amarillo

**Ejecución manual:** `POST /bot-reservas-pendientes/ejecutar-manualmente` (JWT superAdmin)

---

## 13. Paginación

Las respuestas paginadas tienen esta estructura:

```typescript
{
  data: T[],
  meta: {
    total: number,       // Total de registros
    page: number,        // Página actual
    pageSize: number,    // Tamaño de página (default: 15)
    totalPages: number   // Total de páginas
  }
}
```

**Optimizaciones implementadas:**
- Caché en memoria de totales (TTL: 1 minuto por combinación de filtros)
- `estimatedDocumentCount()` para queries sin filtros (10–100x más rápido)
- `skip` limitado a máximo 10,000 documentos para evitar queries muy lentas
- Índices compuestos en MongoDB por `userId+status`, `agenciaId+status`, `createdAt`

---

## 14. Seguridad, logging y rate limiting

### CORS
`origin: true`, `credentials: true`, métodos: GET / HEAD / PUT / PATCH / POST / DELETE

### Validación global
`ValidationPipe` con `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`

### Rate limiting global (ThrottlerGuard)

| Ventana | Límite |
|---|---|
| 60 segundos | 100 requests por IP |
| 10 minutos | 500 requests por IP |
| 1 hora | 2,000 requests por IP |

Endpoints de auth tienen throttle adicional más restrictivo.

### Logs
Pino con `pino-pretty` en desarrollo. En producción: JSON estructurado. Serializers personalizados para req / res / err. Health checks (`/health`) excluidos del log automático.

### Seguridad de credenciales
- Contraseñas con **bcrypt**
- JWT firmado con `JWT_SECRET`
- Todos los secretos exclusivamente en variables de entorno

### Pool de conexiones MongoDB
- `maxPoolSize: 10`, `minPoolSize: 2`
- `serverSelectionTimeoutMS: 5000`, `socketTimeoutMS: 45000`
- `retryWrites: true`, `retryReads: true`

---

## 15. Notas técnicas

1. **`GET /cotizaciones/token/:tokenAcceso`** está registrado después de `GET /cotizaciones/:id`. NestJS puede interceptar el segmento `token` con el parámetro `:id`. Para consumo por token, preferir la ruta pública `GET /cotizaciones/public/token/:tokenAcceso`.

2. **`GET /my-tool/reservas-info`** no requiere JWT en el controlador. En entornos de producción se debe proteger a nivel de infraestructura (WAF, IP allowlist, etc.).

3. **Enum de roles de integración:** la propiedad TypeScript `autodoreDev` en el enum `ValidIntegrationsRoles` tiene el valor HTTP `autocore-dev`.

4. **Fallback My Tool → Autocore:** solo ocurre si el hotel tiene `autocoreId` definido en `hotelMyToolConfig` (`src/config/constants/myToolBookingConstants.ts`).

5. **Cancelación con primera mitad pagada:** si una agencia intenta cancelar una reserva con `pagadoPrimeraMitad: true`, el sistema bloquea la cancelación y envía un correo informando el saldo pendiente. El parámetro `forzarCancelacionConPagoMitad=true` permite al superAdmin forzarla excepcionalmente.

6. **Hoteles My Tool** — la variable de entorno debe coincidir exactamente con el slug en `hotelMyToolConfig`. El slug `bocagrande` usa la env `API_BOCAGRANADE` (con typo histórico en la variable).

---

**Proyecto:** Agencias API — Geh Suites  
**Stack:** NestJS · MongoDB · TypeScript  
**Contacto técnico:** innovacion@gehsuites.com
