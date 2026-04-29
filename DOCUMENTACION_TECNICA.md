# Documentación técnica — Agencias API

Documento alineado al código del repositorio (NestJS). **Base URL HTTP:** `{host}/agencias/v1/`  
**Swagger:** `{host}/agencias/v1/api-docs`

---

## Índice

1. [Descripción general](#1-descripción-general)
2. [Stack y dependencias](#2-stack-y-dependencias)
3. [Arquitectura y estructura de carpetas](#3-arquitectura-y-estructura-de-carpetas)
4. [Módulos y responsabilidades](#4-módulos-y-responsabilidades)
5. [Autenticación y autorización](#5-autenticación-y-autorización)
6. [Integraciones externas](#6-integraciones-externas)
7. [Modelos de datos (resumen)](#7-modelos-de-datos-resumen)
8. [Flujos de negocio](#8-flujos-de-negocio)
9. [Variables de entorno](#9-variables-de-entorno)
10. [Endpoints HTTP (inventario)](#10-endpoints-http-inventario)
11. [Instalación y operación](#11-instalación-y-operación)
12. [Seguridad, logging y rate limiting](#12-seguridad-logging-y-rate-limiting)
13. [Notas y limitaciones conocidas](#13-notas-y-limitaciones-conocidas)
14. [Changelog del documento](#14-changelog-del-documento)

---

## 1. Descripción general

**Agencias API** es un backend NestJS para agencias de viajes. Permite:

- **Reservas hoteleras** vía Autocore y, para hoteles mapeados, vía **My Tool** (con **fallback a Autocore** si My Tool falla).
- **Cotizaciones** con landing pública, PDF y conversión a reserva.
- **Vuelos:** Amadeus (búsqueda/reserva GDS) y **MaarLab / OceanFlights** (JWT de usuario; el servidor resuelve el Bearer hacia MaarLab).
- **Pagos** Cobre (links, billetera, webhooks).
- **Multi-agencia:** roles, políticas, límites de usuario.
- **Booking personas:** flujo con token estático (`x-booking-token` o Bearer igual al valor configurado).
- **Referencia de aeropuertos:** catálogo local en MongoDB, búsqueda predictiva (JWT).
- **Credenciales MaarLab por partner:** colección sincronizable; resolución de API key por agencia / nombre de hotel / legado `maarlabApiKey`.
- **Eventos / convenciones**, **notificaciones**, **integraciones** por API key, **bot** de reservas pendientes, **archivos** (perfil), **Cloudinary** (uso interno).
- **OpenAPI (Swagger)** y **Pino** para logs.

---

## 2. Stack y dependencias

| Componente | Versión / notas (según `package.json`) |
|------------|----------------------------------------|
| Node.js | 20+ recomendado |
| NestJS | ^10.0.0 |
| TypeScript | ^5.1.x (dev) |
| MongoDB + Mongoose | ^8.6.x |
| Validación | class-validator, class-transformer |
| Auth | passport-jwt, bcrypt, @nestjs/jwt |
| HTTP | axios, @nestjs/axios |
| Docs | @nestjs/swagger ^7.4.x |
| Límites | @nestjs/throttler ^6.5.x |
| Logs | nestjs-pino, pino-http |
| Otros | Puppeteer, ExcelJS, Cloudinary, SendGrid, Nodemailer, etc. |

---

## 3. Arquitectura y estructura de carpetas

### Capas

1. **Controllers:** HTTP, DTOs, pipes.
2. **Services:** reglas de negocio, orquestación.
3. **Mongoose:** modelos como “repositorio” + índices en esquemas.

### `src/` (principal)

```
src/
├── agencias/                 # CRUD / saldo / políticas; usa MaarlabCredentialsModule
├── auth/                     # JWT, OTP, refresh, usuarios
├── booking-personas/         # Disponibilidad y reserva con token estático
├── bot-reservas-pendientes/  # Reportes programados + manual
├── cloudinary/               # Servicio interno (controlador sin rutas de negocio)
├── common/                   # HttpCustomService, email, helpers, pipes compartidos
├── config/                   # envs (Joi), constantes (Autocore, MyTool, emails…)
├── cotizaciones/             # Privado + módulo público
├── eventos/
├── files/
├── integrations/             # API keys para terceros (disponibilidad Autocore)
├── main.ts                   # Prefijo global, CORS, ValidationPipe, Swagger
├── maarlab-credentials/      # Entidad + servicio de resolución de Bearer MaarLab
├── my-tool/                  # Herramienta interna (consulta reservas-info)
├── notificaciones/
├── referencia-aeropuertos/   # Catálogo aeropuertos + sugerencias (JWT)
├── reservas/                 # Autocore + My Tool booking, disponibilidad, pagos
├── vuelos/                   # Amadeus (público en mayor parte) + Maarlab (JWT)
└── app.module.ts             # Imports + ThrottlerGuard global + LoggerModule
```

---

## 4. Módulos y responsabilidades

### Auth

- Login, registro, OTP (opcional con `settings.omitirOtp`), refresh token (hex 64 bytes, ~7 días en BD), cambio de credenciales, políticas de agencia, listados admin.
- JWT configurado en `auth.module.ts` con `expiresIn: '60m'` para el **access token**.

### Reservas

- Disponibilidad y reserva **Autocore**; webhooks Cobre/Autocore; búsquedas; paginación superAdmin; cancelación; locks de cancelación; links y billetera.
- **My Tool:** cancelación, mappings por hotel, búsqueda por localizador, creación con body alineado a My Tool + campos internos (`titularInfo`, `total`, etc.). Ver flujo §8.

### Referencia aeropuertos

- Colección MongoDB (seed `scripts/seed-airports.ts`), caché en servicio, endpoints `sugerencias` y `estado` (**JWT**).

### Maarlab credentials

- Colección `MaarlabPartnerCredential`: sincronización vía `npm run sync:maarlab-keys` (usa `MAARLAB_PARTNER_SYNC_BEARER` y `MAARLAB_CHAIN_SEARCH_ENGINE_ID`).
- `MaarlabCredentialsService.resolveBearerForAgencia`: (1) credencial con `agenciaId`, (2) `hotelName` **exacto** igual a `Agencia.fullName`, (3) `maarlabApiKey` en agencia.

### Cotizaciones

- CRUD autenticado, estadísticas, PDF, conversión a reserva, rutas públicas bajo `cotizaciones/public`.

### Vuelos

- **Amadeus:** test, ubicaciones, ciudades, disponibilidad, reservar, consultar/cancelar orden (sin `@Auth()` en la mayoría de rutas del controlador).
- **MaarLab:** todas las rutas bajo `/vuelos/maarlab/*` con **`@Auth()`**; el servicio obtiene el Bearer con `getMaarLabApiKeyOrThrow` según el usuario/agencia.

### Resto

- **Agencias:** alta, saldo, listados, políticas, etc.; integración indirecta con MaarLab credentials.
- **Booking personas:** disponibilidad, link de pago, reserva, webhook; guard `StaticTokenGuard`.
- **Integrations:** alta de integración; disponibilidad con `@ApiKeyProtected`.
- **Bot:** ejecutar manualmente, estado, diagnóstico (roles superAdmin).
- **Files:** subida perfil usuario (JWT + multipart).
- **My-tool (módulo):** `GET /my-tool/reservas-info` (sin JWT en controlador; uso interno).
- **Notificaciones / eventos / cloudinary:** según controladores.

---

## 5. Autenticación y autorización

### Roles (`ValidRoles`)

- `admin`, `user`, `super-admin`, `eventos-super-admin`

### Roles integraciones (`ValidIntegrationsRoles`)

- `autocore-prod`, `autocore-dev` *(en código el enum exporta la clave `autodoreDev` para el valor `autocore-dev`)*

### JWT (usuarios)

- Header: `Authorization: Bearer <accessToken>`
- Access token: payload típico `{ _id }` (ver `JwtPayload`), expiración **60 minutos** (`JwtModule.registerAsync` en `auth.module.ts`).
- Tras login u OTP válido, la respuesta incluye **`accessToken`**, **`refreshToken`**, **`expiresIn`** (string informativa en código; ver nota §13).

### Refresh

- `POST /auth/refresh-token` body: `{ "token": "<refreshToken>" }`

### OTP

- Código numérico de **5 dígitos** (generado entre 10000 y 99999). Validación: `POST /auth/validate-otp` con `{ email, otp }` donde `otp` tiene longitud 5 (`OtpValidationDto`).

### Booking personas (token estático)

- Header preferente: **`x-booking-token: <BOOKING_PERSONAS_TOKEN>`**  
- Alternativa: `Authorization: Bearer <BOOKING_PERSONAS_TOKEN>` (el guard quita el prefijo `Bearer ` y compara el valor completo con env).

### Integraciones

- API Key + Secret según implementación de `ApiKeyGuard` / servicio de integraciones.

### Decoradores frecuentes

- `@Auth(...roles)`, `@GetUser()`, `@ApiKeyProtected()`, `@StaticTokenAuth()`

---

## 6. Integraciones externas

### Autocore

- Disponibilidad, reservas, agencias, billetera, links; headers `access_key` / `secret_key` desde `envs`.

### My Tool (por hotel)

- URLs base en variables `API_*` + credenciales globales `MY_TOOL_EMAIL` / `MY_TOOL_CLAVE`.
- Mapa de slugs en `src/config/constants/myToolBookingConstants.ts` (`hotelMyToolConfig`: slug → IP/base API, `autocoreId` opcional para fallback, nombre, ciudad).
- Slugs actuales incluyen: `aixo`, `azuan`, `avexi`, `marina`, `bocagrande`, `abi`, `boquilla`, `madisson`, `windsor`, `rodadero`, `axis`, `marques`, `sansiraka`, `playasalguero`.

### Cobre, Amadeus, Cloudinary, correo (SendGrid / Nodemailer / Gmail API)

- Sin cambio conceptual respecto a versión anterior; ver `envs.ts` y servicios en `common/`.

### MaarLab

- `MAARLAB_BASE_URL` obligatorio.
- Bearer efectivo: resolución por credenciales de partner + agencia (§4).

---

## 7. Modelos de datos (resumen)

No sustituye el código fuente; resume campos relevantes para integradores.

### Reserva

- Incluye `reservaProvider`: `'autocore' | 'mytool'` (índice).
- `myToolCanalVentaId` opcional.
- `reservation.roomsData[]` admite **`room_id`** además de datos habituales.
- `vuelo[]`: paquetes MaarLab (packageId, respuesta, fecha).
- Locks/cancelación: `cancelInProgress`, `cancelRequestedAt`, etc.
- Índices compuestos frecuentes: por `userId`+`status`, `agenciaId`+`status`, `reservaChatbotId` único, fechas límite, cancelación.

### User, Agencia, Cotizacion, BookingPersona, PaymentPending, Integration, Evento, OtpVerification, RefreshToken

- Mantienen la semántica descrita en versiones anteriores del proyecto; **`Agencia.maarlabApiKey`** sigue siendo fallback tras credenciales de partner.

### Aeropuerto referencia

- Esquema en `referencia-aeropuertos/entities` (campos tipo catálogo: ICAO/IATA, nombre, ciudad, país, geo, etc.).

### MaarlabPartnerCredential

- Campos típicos: vínculo a `agenciaId`, `hotelName` (match exacto con `Agencia.fullName`), `apiKey`, metadatos de sync.

---

## 8. Flujos de negocio

### 8.1 Reserva Autocore (agencia)

1. `POST /reservas/disponibilidad` (JWT)
2. `POST /reservas/reservar?hotelId=` (JWT, pipes de fechas e id hotel)
3. Pagos: `generate-link`, `pago-billetera-single`, `pago-billetera-compuesto`; webhook `change-status`

### 8.2 Reserva My Tool (agencia)

1. Opcional: `GET /reservas/mytool/:hotelSlug/mappings` (JWT)
2. `POST /reservas/mytool/:hotelSlug` (JWT)  
   - Body: estructura My Tool + `titularInfo`, `total`, retenciones opcionales, etc.  
   - **`bookData.localizador`:** lo **sobrescribe** el servidor al generar localizador estilo chatbot.  
   - **`bookData.acuerdos`:** se envía a My Tool (como hasta ahora). **`notes`** (opcional, raíz del body): solo interno → **`reservation.notes`** en MongoDB; **no** se envía a My Tool.  
   - **`rooms[].nombreHabitacion`** y **`rooms[].room_id`:** se persisten en `roomsData` / lógica interna y **no** se reenvían a My Tool.  
   - **`mascotasNumber`** (opcional, 0–50): solo MongoDB; **no** se envía a My Tool. `0` = sin mascotas; `> 0` guarda cantidad y deja `reserva.mascotas` en `true`.  
3. Si My Tool falla y el hotel tiene `autocoreId` en `hotelMyToolConfig`, **fallback Autocore**.
4. Cancelación: `POST /reservas/mytool/cancelar` (JWT); búsqueda externa: `GET .../buscar` con query.

### 8.3 Cotización pública

1. Agencia crea cotización (JWT)
2. Cliente abre `GET /cotizaciones/public/token/:tokenAcceso`
3. Responde `POST /cotizaciones/public/responder/:tokenAcceso`
4. Conversión automática o manual según reglas de negocio del servicio

### 8.4 Booking personas

1. Disponibilidad y links con token estático (§5)
2. Webhook de pago y creación de reserva con `paymentCode`

### 8.5 Vuelos MaarLab

1. Cliente llama `POST /vuelos/maarlab/disponibilidad` (JWT)
2. Backend resuelve Bearer MaarLab para la agencia del usuario
3. Continúa flujo paquete / extras / reserva / token pago según endpoints

### 8.6 Referencia aeropuertos

1. Carga inicial: `npm run seed:airports` (y opcional `--indexes-only`)
2. App: `GET /referencia-aeropuertos/sugerencias?q=&country=&limit=` (JWT)
3. `GET /referencia-aeropuertos/estado` (JWT): conteo documentos

### 8.7 Sincronización claves MaarLab (operación)

1. Configurar envs de partner (§9)
2. `npm run sync:maarlab-keys`
3. Las agencias usan vuelos MaarLab sin pegar manualmente el Bearer si hay credencial o `hotelName` coincide

---

## 9. Variables de entorno

Definidas y validadas en `src/config/envs.ts` (Joi). Lista de **requeridas** (salvo donde se indique opcional):

| Variable | Uso |
|----------|-----|
| `PORT` | Puerto HTTP |
| `MONGO_URL` | MongoDB |
| `JWT_SECRET` | Firma JWT |
| `COBRE_*` (5 vars) | Cobre |
| `CLOUDINARY_*` (3) | Cloudinary |
| `SENDER_EMAIL`, `EMAIL_APP_PASSWORD` | Nodemailer |
| `SENDGRID_API_KEY` | SendGrid |
| `GOOGLE_GMAIL_*` (5) | Gmail API |
| `AUTOCORE_URL`, `AUTOCORE_ACCESS_KEY`, `AUTOCORE_SECRET_KEY` | Autocore prod |
| `AUTOCORE_URL_DEV`, `AUTOCORE_ACCESS_KEY_DEV`, `AUTOCORE_SECRET_KEY_DEV` | Opcional |
| `MY_TOOL_EMAIL`, `MY_TOOL_CLAVE` | Login My Tool |
| `API_AIXO`, `API_AZUAN`, `API_RODADERO`, `API_AVEXI`, `API_BOCAGRANADE`, `API_ABI`, `API_MADISSON`, `API_WINDSOR`, `API_MARINA`, `API_AXIS`, `API_MARQUES`, `API_SANSIRAKA`, `API_PLAYASALGUERO` | Base URL/API por hotel My Tool |
| `AMADEUS_API_KEY`, `AMADEUS_API_SECRET`, `AMADEUS_BASE_URL` | Amadeus |
| `BOOKING_PERSONAS_TOKEN` | Token estático booking personas |
| `MAARLAB_BASE_URL` | MaarLab |
| `MAARLAB_AUTH_TOKEN` | Opcional (legado, vacío permitido) |
| `MAARLAB_PARTNER_SYNC_BEARER` | Opcional; script sync |
| `MAARLAB_CHAIN_SEARCH_ENGINE_ID` | Opcional; script sync |

`.unknown(true)` en Joi permite variables extra sin romper el arranque.

---

## 10. Endpoints HTTP (inventario)

Prefijo: **`/agencias/v1`**. “JWT” = `Authorization: Bearer`.

### Auth — `/auth`

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| POST | `/auth/sign-up/:id` | No | Throttle 3/min |
| POST | `/auth/register-user` | JWT admin/superAdmin | |
| POST | `/auth/sign-in` | No | Throttle 5/min |
| POST | `/auth/validar-token` | No | Body con token |
| POST | `/auth/validate-access-token` | No | |
| POST | `/auth/refresh-token` | No | Throttle 10/min |
| POST | `/auth/validate-otp` | No | Throttle 5/min |
| POST | `/auth/request-password-change` | No | Throttle 3/min |
| PATCH | `/auth/new-credentials` | JWT | |
| PATCH | `/auth/switch-activation-status/:userId` | JWT admin/superAdmin | |
| GET | `/auth/getAllUsers` | JWT superAdmin | |
| PATCH | `/auth/politicas-agencia` | JWT | |

### Reservas — `/reservas`

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| POST | `/reservas/reservar` | JWT | Query `hotelId` |
| PUT | `/reservas/editar-reserva/:reservaId` | JWT | |
| DELETE | `/reservas/cancelar-reserva` | JWT | |
| POST | `/reservas/change-status` | No | Webhook |
| GET | `/reservas/reservas-by-user` | JWT | |
| GET | `/reservas/reservas-by-agencia` | JWT admin | |
| POST | `/reservas/generate-link` | JWT | |
| POST | `/reservas/pago-billetera-single` | JWT | |
| POST | `/reservas/pago-billetera-compuesto` | JWT | |
| POST | `/reservas/disponibilidad` | JWT | |
| POST | `/reservas/disponibilidad-debug` | JWT | |
| GET | `/reservas/buscar/chatbot-id` | JWT | Query |
| GET | `/reservas/buscar/agente` | JWT | |
| GET | `/reservas/buscar/agencia` | JWT | |
| GET | `/reservas/buscar/huesped` | JWT | |
| GET | `/reservas/buscar/estado` | JWT | |
| GET | `/reservas` | JWT superAdmin | Query paginación/filtros |
| DELETE | `/reservas/cancelar-reserva-admin/:reservaId` | JWT superAdmin | |
| PUT | `/reservas/status/:reservaId` | JWT superAdmin | Query opcionales |
| PUT | `/reservas/fechas-pago/:reservaId` | JWT admin/superAdmin | |
| POST | `/reservas/mytool/cancelar` | JWT | |
| GET | `/reservas/mytool/:hotelSlug/mappings` | JWT | |
| GET | `/reservas/mytool/:hotelSlug/buscar` | JWT | Query localizador, nombre |
| POST | `/reservas/mytool/:hotelSlug` | JWT | Crear + fallback |

### Referencia aeropuertos — `/referencia-aeropuertos`

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/referencia-aeropuertos/sugerencias` | JWT |
| GET | `/referencia-aeropuertos/estado` | JWT |

### Cotizaciones — `/cotizaciones` (controlador con `@Auth()` a nivel clase)

| Método | Ruta | Notas |
|--------|------|--------|
| POST | `/cotizaciones` | |
| GET | `/cotizaciones/debug-user` | |
| POST | `/cotizaciones/test-validation` | |
| POST | `/cotizaciones/from-disponibilidad` | |
| GET | `/cotizaciones` | `page`, `limit` |
| GET | `/cotizaciones/estadisticas` | |
| GET | `/cotizaciones/test-disponibilidad-directa` | |
| GET | `/cotizaciones/:id` | |
| GET | `/cotizaciones/token/:tokenAcceso` | Ver §13 orden de rutas |
| POST | `/cotizaciones/responder/:tokenAcceso` | |
| POST | `/cotizaciones/pdf` | |
| POST | `/cotizaciones/convertir-reserva/:id` | |
| PATCH | `/cotizaciones/:id` | |
| DELETE | `/cotizaciones/:id` | |

### Cotizaciones públicas — `/cotizaciones/public`

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/cotizaciones/public/token/:tokenAcceso` | No |
| GET | `/cotizaciones/public/:id` | No |
| POST | `/cotizaciones/public/responder/:tokenAcceso` | No |

### Vuelos — `/vuelos`

**Amadeus / general (sin JWT en rutas listadas salvo que añadas middleware global — no hay):**

| Método | Ruta |
|--------|------|
| GET | `/vuelos/test` |
| GET | `/vuelos/test-auth` |
| GET | `/vuelos/ubicaciones` |
| GET | `/vuelos/aeropuertos/iata/:iataCode` |
| GET | `/vuelos/ciudades` |
| GET | `/vuelos/ciudades/buscar` |
| POST | `/vuelos/disponibilidad-test` |
| POST | `/vuelos/disponibilidad` |
| POST | `/vuelos/reservar` |
| GET | `/vuelos/reservas/:flightOrderId` |
| DELETE | `/vuelos/reservas/:flightOrderId` |

**MaarLab (todas JWT):**  
`POST /vuelos/maarlab/disponibilidad`, `POST .../paquete`, `GET .../equipaje`, `POST .../extras`, `DELETE .../extras`, `POST .../reservar`, `GET .../token-pago`, `GET .../paquete`, `GET .../contrato-atol`, `POST .../search-engine/complete-process`, `POST .../travel-agency/complete-process`, `POST .../v1/travel-agency/complete-process`, `GET .../search-engine/mapping-external-id/:idSearchEngine`

### Agencias — `/agencias`

| Método | Ruta | Auth |
|--------|------|------|
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

### Booking personas — `/booking-personas`

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/booking-personas/disponibilidad` | Token estático |
| POST | `/booking-personas/generar-link-pago` | Token estático |
| POST | `/booking-personas/reservar` | Token estático |
| POST | `/booking-personas/change-status` | No | Webhook |

### Integraciones — `/integrations`

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/integrations/create` | No |
| POST | `/integrations/disponibilidad` | API Key |

### Bot — `/bot-reservas-pendientes`

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/bot-reservas-pendientes/ejecutar-manualmente` | JWT superAdmin |
| POST | `/bot-reservas-pendientes/estado` | JWT superAdmin |
| POST | `/bot-reservas-pendientes/diagnostico` | JWT superAdmin |

### Files — `/files`

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/files/user-profile` | JWT multipart |

### My Tool (herramienta) — `/my-tool`

| Método | Ruta | Auth |
|--------|------|------|
| GET | `/my-tool/reservas-info` | No en controlador |

### Notificaciones — `/notificaciones`

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/notificaciones/reservas` | No |

### Eventos — `/eventos`

| Método | Ruta | Auth |
|--------|------|------|
| POST | `/eventos/create` | JWT |
| GET | `/eventos` | JWT superAdmin / eventos-super-admin |

### Cloudinary

- No hay rutas HTTP documentadas en controlador; uso desde servicios.

---

## 11. Instalación y operación

```bash
npm install
cp .env.example .env   # si existe; configurar según §9
npm run build
npm run start:prod
```

**Scripts útiles:**

| Script | Descripción |
|--------|-------------|
| `npm run start:dev` | Desarrollo |
| `npm run seed:airports` | Seed catálogo aeropuertos |
| `npm run seed:airports:indexes` | Solo índices |
| `npm run sync:maarlab-keys` | Sync credenciales partner MaarLab |
| `npm run migrate:maarlab-api-key` | Migración legado MaarLab |
| `npm run script:register-agencias-maarlab` | Registro agencias MaarLab |
| `npm run test` / `test:e2e` | Pruebas |

**Health rápido:** `GET /agencias/v1/vuelos/test`

---

## 12. Seguridad, logging y rate limiting

- **CORS:** `origin: true`, `credentials: true`, métodos GET/HEAD/PUT/PATCH/POST/DELETE (`main.ts`).
- **ValidationPipe:** `whitelist`, `forbidNonWhitelisted`, `transform`.
- **Throttler global:** corto 100 req/60s, medio 500/10 min, largo 2000/h por IP (ver `app.module.ts`). Endpoints auth tienen `@Throttle` adicional.
- **Logs:** Pino (`nestjs-pino`), serializers de req/res/err.
- **Contraseñas:** bcrypt; JWT firmado; secretos solo en env.

---

## 13. Notas y limitaciones conocidas

1. **`GET /cotizaciones/token/:tokenAcceso`** está registrado **después** de **`GET /cotizaciones/:id`**. En Nest, `:id` puede interceptar el segmento `token`. Para uso autenticado por token, suele bastar la ruta **pública** `GET /cotizaciones/public/token/:tokenAcceso`. Si se necesita la ruta privada, conviene **reordenar** rutas en el controlador.
2. **`expiresIn` en respuesta de login:** el servicio devuelve la cadena `'15m'` en el objeto de tokens, mientras el **JWT real** usa `expiresIn: '60m'` en `JwtModule`. Confiar en el payload JWT o en pruebas de expiración reales.
3. **`GET /my-tool/reservas-info`:** no exige JWT en el controlador; revisar exposición en entornos públicos (WAF, IP allowlist, o añadir guard si aplica).
4. Enum **`autodoreDev`:** nombre de propiedad en TypeScript; valor HTTP del rol es `autocore-dev`.

---

## 14. Changelog del documento

| Fecha | Cambio |
|-------|--------|
| **2026-04-27** | Reescritura completa: módulos `referencia-aeropuertos`, `maarlab-credentials`, reservas My Tool, variables `API_*` y MaarLab sync, flujos actualizados, inventario de endpoints, JWT 60m, OTP 5 dígitos, booking token, notas técnicas. |
| *(histórico)* | Versiones anteriores cubrían Autocore/cotizaciones/vuelos base. |

---

**Documento:** 3.0.0  
**Última revisión:** 27 de abril de 2026  
**Contacto referido en versiones previas:** innovacion@gehsuites.com
