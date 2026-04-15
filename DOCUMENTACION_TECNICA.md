# Documentacion Tecnica - Agencias API

## Indice

1. [Descripcion General](#descripcion-general)
2. [Stack Tecnologico](#stack-tecnologico)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Modulos Principales](#modulos-principales)
5. [Integraciones Externas](#integraciones-externas)
6. [Modelos de Datos](#modelos-de-datos)
7. [Autenticacion y Autorizacion](#autenticacion-y-autorizacion)
8. [Flujos de Negocio Principales](#flujos-de-negocio-principales)
9. [Variables de Entorno](#variables-de-entorno)
10. [API Endpoints](#api-endpoints)
11. [Instalacion y Configuracion](#instalacion-y-configuracion)

---

## Descripcion General

**Agencias API** es una plataforma backend desarrollada con NestJS para la gestion integral de agencias de viajes. El sistema permite:

- **Gestion de Reservas Hoteleras** mediante integracion con Autocore
- **Busqueda y Reserva de Vuelos** mediante integracion con Amadeus y MaarLab/OceanFlights
- **Sistema de Pagos** mediante integracion con Cobre
- **Cotizaciones y Conversion Automatica** a reservas
- **Gestion Multi-Agencia** con permisos y roles
- **Reportes Automatizados** de reservas pendientes
- **Sistema de Notificaciones** por email (SendGrid, Nodemailer, Google Gmail API)
- **Booking para Personas** (reservas directas sin agencia, con token estatico)
- **Documentacion Swagger/OpenAPI** integrada
- **Rate Limiting** global con Throttler
- **Logging Estructurado** con Pino

---

## Stack Tecnologico

### **Framework y Lenguajes**
- **Framework Backend:** NestJS v10.0.0
- **Lenguaje:** TypeScript v5.1.3
- **Runtime:** Node.js v20+

### **Base de Datos**
- **Base de Datos:** MongoDB
- **ODM:** Mongoose v8.6.2

### **Principales Dependencias**

#### **Core NestJS**
```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/config": "^4.0.0",
  "@nestjs/mongoose": "^10.0.10",
  "@nestjs/jwt": "^10.2.0",
  "@nestjs/passport": "^10.0.3",
  "@nestjs/schedule": "^6.0.0",
  "@nestjs/swagger": "^7.4.2",
  "@nestjs/throttler": "^6.5.0",
  "@nestjs/axios": "^3.0.3",
  "@nestjs/platform-express": "^10.0.0",
  "@nestjs/mapped-types": "*"
}
```

#### **Autenticacion y Seguridad**
```json
{
  "bcrypt": "^5.1.1",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.1",
  "joi": "^17.13.3"
}
```

#### **Integraciones y APIs**
```json
{
  "axios": "^1.7.7",
  "@sendgrid/mail": "^8.1.5",
  "nodemailer": "^7.0.1"
}
```

#### **Logging**
```json
{
  "nestjs-pino": "^4.5.0",
  "pino-http": "^11.0.0",
  "pino-pretty": "^13.1.3"
}
```

#### **Procesamiento y Utilidades**
```json
{
  "puppeteer": "^24.25.0",
  "exceljs": "^4.4.0",
  "cloudinary": "^2.5.1",
  "uuid": "^10.0.0",
  "date-fns": "^4.1.0",
  "@formkit/tempo": "^0.1.2",
  "libphonenumber-js": "^1.11.19",
  "slugify": "^1.6.6",
  "buffer-to-stream": "^1.0.0",
  "dotenv": "^16.4.5"
}
```

#### **Validacion**
```json
{
  "class-validator": "^0.14.1",
  "class-transformer": "^0.5.1"
}
```

---

## Arquitectura del Sistema

### **Arquitectura por Capas**

```
+---------------------------------------------+
|          Controllers (HTTP Layer)            |
|  - Reciben requests HTTP                    |
|  - Validan DTOs                             |
|  - Retornan responses                       |
+--------------------+------------------------+
                     |
+--------------------v------------------------+
|          Services (Business Logic)           |
|  - Logica de negocio                         |
|  - Orquestacion de operaciones               |
|  - Transformacion de datos                   |
+--------------------+------------------------+
                     |
+--------------------v------------------------+
|     Repositories (Data Access Layer)         |
|  - Mongoose Models                           |
|  - Consultas a MongoDB                       |
|  - Gestion de transacciones                  |
+---------------------------------------------+
```

### **Estructura de Directorios**

```
src/
|-- agencias/              # Modulo de gestion de agencias
|-- auth/                  # Autenticacion y autorizacion
|   |-- decorators/        # Decoradores: Auth, GetUser, ApiKeyProtected, StaticTokenAuth
|   |-- entities/          # User, OtpVerification, RefreshToken
|   |-- guards/            # JwtGuard, UserRoleGuard, ApiKeyGuard, StaticTokenGuard
|   +-- interfaces/        # ValidRoles, ValidIntegrationsRoles
|-- booking-personas/      # Reservas directas para personas (sin agencia)
|   |-- entities/          # BookingPersona, PaymentPending
|   +-- dto/               # DTOs de disponibilidad, reserva, pago
|-- bot-reservas-pendientes/ # Bot automatizado de reportes
|-- cloudinary/            # Gestion de archivos en la nube
|-- common/                # Recursos compartidos
|   |-- decorators/        # Decoradores personalizados
|   |-- dto/               # DTOs compartidos
|   |-- helpers/           # ErrorManager, ConvertidorMoneda, getCellInfo
|   |-- interface/         # Interfaces compartidas (IreservaInfoBd, etc.)
|   |-- pipes/             # Pipes de validacion (ParseMongoIdPipe)
|   +-- services/          # HttpCustomService, SendEmailService
|-- config/                # Configuracion global
|   +-- constants/         # autocoreConstants, amadeusConstants, emailPlantillas, etc.
|-- cotizaciones/          # Modulo de cotizaciones
|-- eventos/               # Modulo de eventos/convenciones
|-- files/                 # Gestion de archivos (upload de imagenes)
|-- integrations/          # Integraciones externas via API Keys
|-- my-tool/               # Herramientas internas
|-- notificaciones/        # Sistema de notificaciones
|-- reservas/              # Modulo de reservas
|   |-- pipes/             # ParseCheckinCheckoutPipe, ParseHotelIdPipe
|   +-- utils/             # fechaLimitePago.utils
+-- vuelos/                # Modulo de vuelos (Amadeus + MaarLab)
    |-- services/          # FlightEnrichmentService, ErrorHandlerService
    |-- interceptors/      # ErrorHandlerInterceptor
    +-- filters/           # ErrorHandlerFilter
```

---

## Modulos Principales

### **1. Auth Module**
**Responsabilidad:** Gestion de autenticacion, autorizacion y usuarios.

**Componentes:**
- `AuthService`: Logica de autenticacion (login, registro, JWT, OTP)
- `AuthController`: Endpoints de autenticacion
- `JwtStrategy`: Estrategia de validacion JWT
- `ApiKeyGuard`: Guard para API Keys externas
- `UserRoleGuard`: Guard para roles de usuario
- `StaticTokenAuthGuard`: Guard para token estatico (booking-personas)

**Entidades:**
- `User`: Usuarios del sistema
- `OtpVerification`: Codigos OTP para verificacion 2FA
- `RefreshToken`: Tokens de actualizacion

**Decoradores Personalizados:**
- `@Auth(...roles)`: Combina AuthGuard + RoleProtected + UserRoleGuard
- `@GetUser(property?)`: Obtiene el usuario autenticado o una propiedad especifica
- `@ApiKeyProtected(...roles)`: Proteccion por API Key con roles de integracion
- `@StaticTokenAuth()`: Autenticacion por token estatico (booking-personas)
- `@GetIntegration(property?)`: Obtiene la integracion autenticada
- `@RoleProtected(...roles)`: Setea metadata de roles requeridos

**Caracteristicas:**
- Autenticacion JWT con tokens firmados
- Refresh tokens (UUID v4 con expiracion)
- Verificacion OTP (opcional por usuario, configurable en settings.omitirOtp)
- Roles: `admin`, `user`, `super-admin`, `eventos-super-admin`
- Hashing de contrasenas con bcrypt
- Cambio de contrasena con validacion
- Validacion de tokens (validar-token, validate-access-token)
- Activacion/desactivacion de usuarios
- Gestion de politicas de agencia por usuario
- Rate limiting por endpoint (Throttler)

---

### **2. Reservas Module**
**Responsabilidad:** Gestion completa del ciclo de vida de reservas hoteleras.

**Componentes:**
- `ReservasService`: Logica de negocio de reservas
- `ReservasController`: Endpoints CRUD y busquedas de reservas
- `ParseCheckinCheckoutPipe`: Validacion de fechas check-in/check-out
- `ParseHotelIdPipe`: Validacion de ID de hotel contra constantes de Autocore
- Integracion con **Autocore** para disponibilidad y creacion de reservas

**Entidades:**
- `Reserva`: Reserva hotelera completa

**Caracteristicas:**
- Consulta de disponibilidad en tiempo real (Autocore)
- Creacion de reservas con validacion de hotel
- Edicion de reservas (datos y en Autocore)
- Cancelacion de reservas (usuario y admin)
- Gestion de fechas limite de pago
- Calculo de retenciones fiscales (reteFuente, reteIva, reteIca)
- Soporte para mascotas, transporte y tours
- Planes alimentarios (desayuno, almuerzo, cena)
- Generacion de links de pago (Cobre)
- Pago con billetera prepago (single y compuesto)
- Webhook de cambio de estado de pago (Autocore -> Cobre)
- Sistema de busqueda avanzado: por chatbotId, agente, agencia, huesped, estado
- Paginacion en listados
- Actualizacion manual de status (superAdmin)
- Actualizacion de fechas de pago
- Control de cancelacion con locks (cancelInProgress)
- Historial de links de pago
- Vinculacion con vuelos MaarLab

---

### **3. Cotizaciones Module**
**Responsabilidad:** Gestion de cotizaciones y conversion automatica a reservas.

**Componentes:**
- `CotizacionesService`: Logica de cotizaciones
- `CotizacionesController`: Endpoints privados (autenticados)
- `CotizacionesPublicController`: Endpoints publicos (token de acceso)

**Entidades:**
- `Cotizacion`: Cotizacion con estados (EN_ESPERA=0, ACEPTADA=1, RECHAZADA=2, CONVERTIDA_RESERVA=3)

**Caracteristicas:**
- Creacion de cotizaciones manuales y desde disponibilidad
- Generacion de PDF con Puppeteer (sin botones)
- Landing page personalizada con token de acceso unico
- Aceptacion/Rechazo publico mediante token
- Conversion automatica a reserva tras aceptacion
- Markup personalizado por agencia
- Upload de PDF a Cloudinary
- Estadisticas de cotizaciones por agencia
- Listado paginado (superAdmin ve todas, demas ven las de su agencia)
- Endpoints publicos sin autenticacion (por token)
- Endpoints privados de prueba/debug

---

### **4. Vuelos Module**
**Responsabilidad:** Busqueda y reserva de vuelos mediante Amadeus y MaarLab/OceanFlights.

**Componentes:**
- `VuelosService`: Orquestacion de busqueda de vuelos
- `AmadeusService`: Integracion directa con API de Amadeus
- `MaarlabService`: Integracion con MaarLab/OceanFlights
- `FlightEnrichmentService`: Enriquecimiento de datos (nombres de ciudades)
- `ErrorHandlerService`: Manejo centralizado de errores de vuelos
- `VuelosController`: Endpoints de vuelos
- `ErrorHandlerInterceptor`: Interceptor global de errores del modulo
- `ErrorHandlerFilter`: Filtro de excepciones del modulo

**Caracteristicas Amadeus:**
- Busqueda de ubicaciones (aeropuertos, ciudades)
- Busqueda de vuelos por IATA
- Busqueda de ofertas de vuelos
- Enriquecimiento con nombres de ciudades
- Creacion de ordenes de vuelo (reservas)
- Consulta y cancelacion de ordenes
- Autenticacion OAuth2 con Amadeus (token cacheado)

**Caracteristicas MaarLab/OceanFlights:**
- Busqueda de disponibilidad de vuelos
- Creacion de paquetes (vuelo + hotel)
- Gestion de equipaje
- Gestion de extras (agregar/eliminar)
- Reserva de paquetes
- Generacion de token de pago
- Consulta de paquetes
- Contrato ATOL
- Proceso completo via Search Engine
- Proceso completo via Travel Agency (v0 y v1)
- Mapping de IDs externos
- API Key por agencia (`agencia.maarlabApiKey`)

---

### **5. Agencias Module**
**Responsabilidad:** Gestion de agencias de viajes (mayoristas y minoristas).

**Componentes:**
- `AgenciasService`: Logica de agencias
- `AgenciasController`: Endpoints CRUD

**Entidades:**
- `Agencia`: Agencia con informacion de Cobre, Autocore y MaarLab

**Caracteristicas:**
- Categorias: Mayorista (1) o Minorista (0)
- Creacion de agencia en Autocore y Cobre simultanea
- Gestion de saldo y billetera prepago
- Recarga de billetera
- Limite de usuarios por agencia (min 1, max 100)
- Permisos de cartera
- Informacion de documentos (NIT, CC, CE, PA)
- Busqueda por propiedad
- Activacion/desactivacion de agencias
- Estadisticas: agencias creadas por termino, agencias con reserva
- Politicas de agencia
- API Key MaarLab por agencia
- Obtencion de nombre y politicas de agencia por ID

---

### **6. Booking Personas Module**
**Responsabilidad:** Reservas hoteleras directas para personas sin necesidad de agencia.

**Componentes:**
- `BookingPersonasService`: Logica de reservas para personas
- `BookingPersonasController`: Endpoints protegidos con token estatico

**Entidades:**
- `BookingPersona`: Reserva directa para personas
- `PaymentPending`: Pagos pendientes (tracking de estado de pago)

**Autenticacion:** Token estatico configurado en `BOOKING_PERSONAS_TOKEN` (decorador `@StaticTokenAuth()`)

**Caracteristicas:**
- Consulta de disponibilidad
- Generacion de link de pago
- Creacion de reserva (requiere pago previo)
- Webhook de cambio de estado de pago (Autocore)
- Tracking de pagos pendientes con estados: PENDING, PAID, REJECTED, CANCELLED

---

### **7. Common Module**
**Responsabilidad:** Servicios y utilidades compartidas.

**Servicios:**
- `HttpCustomService`: Cliente HTTP para integraciones externas
  - Autocore (reservas, disponibilidad, agencias, billetera)
  - Cobre (pagos, billeteras, links de pago)
- `SendEmailService`: Envio de emails (SendGrid + Nodemailer + Google Gmail API)

**Helpers:**
- `ErrorManager`: Manejo centralizado de errores
- `ConvertidorMoneda`: Conversion de divisas
- `getCellInfo`: Procesamiento de celdas Excel

---

### **8. Bot Reservas Pendientes Module**
**Responsabilidad:** Bot automatizado para reportes de reservas pendientes.

**Caracteristicas:**
- Cron jobs programados con `@nestjs/schedule` (diario a las 8:00 AM)
- Generacion de reportes Excel (ExcelJS)
- Envio automatico por email
- Filtros por estados de pago y fechas limite
- Ejecucion manual via endpoint (solo superAdmin)
- Endpoint de estado del bot
- Endpoint de diagnostico de reservas

---

### **9. Cloudinary Module**
**Responsabilidad:** Gestion de archivos en Cloudinary.

**Caracteristicas:**
- Upload de imagenes (usuarios, agencias)
- Upload de PDFs (cotizaciones)
- Eliminacion de recursos
- URLs firmadas y seguras

**Nota:** El controlador esta vacio (sin endpoints expuestos), la logica se usa internamente desde otros servicios.

---

### **10. Notificaciones Module**
**Responsabilidad:** Sistema de notificaciones por email.

**Caracteristicas:**
- Notificacion de pago de reservas
- Plantillas de email personalizadas (HTML)
- Envio de confirmaciones de reserva
- Notificaciones de estado de pago

**Endpoint unico:** `POST /notificaciones/reservas`

---

### **11. Eventos Module**
**Responsabilidad:** Gestion de reservas de eventos y convenciones.

**Caracteristicas:**
- Creacion de reservas de eventos con informacion detallada:
  - Tipo de evento (enum TipoEvento)
  - Organizador (nombre, telefono, email)
  - Cantidad de asistentes
  - Horarios del evento (multiples dias con asistentes por dia)
  - Tipo de acomodacion (enum TipoAcomodacion)
  - Flexibilidad del evento
  - Alimentos y bebidas (estacion cafe, coffee break, desayuno, almuerzo, cena)
  - Audiovisuales e items
  - Decoracion
  - Alojamiento
  - Observaciones
- Listado de eventos (solo superAdmin y eventosSuperAdmin)

---

### **12. Files Module**
**Responsabilidad:** Upload y procesamiento de archivos.

**Caracteristicas:**
- Upload de imagen de perfil de usuario
- Validacion de tipo de archivo (fileFilter)
- Integracion con Cloudinary para almacenamiento

---

### **13. Integrations Module**
**Responsabilidad:** Gestion de integraciones externas mediante API Keys.

**Caracteristicas:**
- Generacion de API Keys para terceros (crypto random)
- Autenticacion mediante API Key + Secret Key (hasheada con bcrypt)
- Endpoints de disponibilidad para integraciones
- Roles de integracion: `autocore-prod`, `autocore-dev`
- Soporte para ambiente dev y prod de Autocore

---

### **14. My Tool Module**
**Responsabilidad:** Herramientas internas de la organizacion.

**Caracteristicas:**
- Consulta de informacion de reservas consolidada
- APIs por hotel configuradas en variables de entorno

---

## Integraciones Externas

### **1. Autocore (PMS Hotelero)**

**Proposito:** Sistema de gestion hotelera para reservas, disponibilidad y pagos.

**Endpoints Utilizados:**
- `POST /v2/bookings/agencies/{category}/availability` - Consultar disponibilidad
- `POST /v2/bookings/hotel_id={id}` - Crear reserva
- `PUT /v2/bookings/chatbot/{chatbotId}` - Editar reserva
- `DELETE /v2/bookings/chatbot/{chatbotId}` - Cancelar reserva
- `POST /v2/agencies` - Crear agencia
- `GET/PUT /v2/preloaded-balance/agencies/{id}` - Gestion de billetera
- `POST /v2/links/schedule/` - Crear link de pago
- `POST /v2/links/preloaded-balance` - Pagar con billetera

**Autenticacion:**
```typescript
headers: {
  'access_key': envs.autocoreAccessKey,
  'secret_key': envs.autocoreSecretKey
}
```

**Hoteles Configurados:**
```
Cartagena: Azuan (13645), Aixo (13633), Avexi (13644), Marina (13643),
           Bocagrande (14364), Abi (17644), Boquilla (13677)
Bogota:    Windsor (18004), Madisson (16255)
Santa Marta: Rodadero (17491), Axis (19629), Sansiraka (15740),
             Playa Salguero Hotel (21590)
```

**Ambientes:** Produccion y Desarrollo (configurables por env vars separadas)

---

### **2. Cobre (Pasarela de Pagos)**

**Proposito:** Gestion de pagos, billeteras y links de pago.

**Endpoints Utilizados:**
- `POST /v1/auth` - Generar token OAuth
- `POST /v1/accounts` - Crear bolcillo (billetera)
- `POST /v1/counterparties` - Crear counterparty (pagador)
- `POST /v1/money_movements` - Generar link de pago

---

### **3. Amadeus (Vuelos)**

**Proposito:** Busqueda y reserva de vuelos internacionales.

**Endpoints Utilizados:**
- `POST /v1/security/oauth2/token` - Autenticacion OAuth2
- `GET /v1/reference-data/locations` - Buscar aeropuertos/ciudades
- `GET /v2/shopping/flight-offers` - Buscar ofertas de vuelos
- `POST /v1/booking/flight-orders` - Crear orden de vuelo
- `GET /v1/booking/flight-orders/{id}` - Consultar orden
- `DELETE /v1/booking/flight-orders/{id}` - Cancelar orden

---

### **4. MaarLab / OceanFlights (Vuelos)**

**Proposito:** Busqueda y reserva de vuelos via consolidador MaarLab.

**Autenticacion:** Bearer token por agencia (`agencia.maarlabApiKey`), gestionado individualmente.

**Funcionalidades:**
- Busqueda de disponibilidad
- Creacion de paquetes
- Gestion de equipaje y extras
- Reserva de paquetes
- Generacion de tokens de pago
- Contratos ATOL
- Procesos completos (Search Engine y Travel Agency)
- Mapping de IDs externos

---

### **5. Cloudinary (Almacenamiento)**

**Proposito:** Almacenamiento de imagenes y PDFs.

**Configuracion:**
```typescript
cloudinary.config({
  cloud_name: envs.cloudinaryName,
  api_key: envs.cloudinaryApiKey,
  api_secret: envs.cloudinaryApiSecret
});
```

---

### **6. Email (SendGrid + Nodemailer + Google Gmail API)**

**Proposito:** Envio de emails transaccionales y notificaciones.

**Proveedores:**
- **SendGrid**: Envio principal de emails
- **Nodemailer**: Envio alternativo
- **Google Gmail API**: Envio via API de Gmail con OAuth2 refresh tokens

**Tipos de Emails:**
- Confirmaciones de reserva
- PDFs de cotizaciones
- Reportes automatizados (Excel)
- OTPs de verificacion
- Cambios de contrasena
- Notificaciones de pago

---

### **7. My Tool (Integracion Interna)**

**APIs por Hotel:**
```
API_AIXO, API_AZUAN, API_RODADERO, API_AVEXI, API_BOCAGRANADE,
API_ABI, API_MADISSON, API_WINDSOR, API_MARINA, API_AXIS
```

---

## Modelos de Datos

### **User (Usuario)**

```typescript
{
  _id: ObjectId,
  email: string,              // Unico, lowercase, index
  password: string,           // Hasheado con bcrypt, select: false
  telefono: string,           // Validacion formato telefonico internacional
  fullName: string,           // Lowercase, trim, 2-100 caracteres
  isActive: boolean,          // Default: true
  firstLog: boolean,          // Default: true
  role: string[],             // Enum ValidRoles, default: ['admin']
  imageUrl: string,           // Default: ''
  agencia: ObjectId,          // Referencia a Agencia, required
  otpRef: ObjectId,           // Referencia a OtpVerification, default: null
  reservas: ObjectId[],       // Referencias a Reserva
  eventos: ObjectId[],        // Referencias a Evento
  settings: {
    omitirOtp: boolean        // Default: false
  },
  politicasAgencia: string,   // Default: ''
  createdAt: Date,
  updatedAt: Date
}
```

---

### **Agencia (Agencia de Viajes)**

```typescript
{
  _id: ObjectId,
  emailContacto: string,      // Unico, index
  telefonoContacto: string,   // Index
  fullName: string,           // Lowercase, trim, 2-200 caracteres
  slug: string,               // Unico, index
  saldo: number,              // Default: 0, min: 0
  category: 0 | 1,            // 0: Minorista, 1: Mayorista, index
  documentInfo: {
    tipo: 'CC' | 'NIT' | 'CE' | 'PA',
    document: string          // Unico
  },
  cobreInfo: {
    bolcilloId: string,       // ID de billetera en Cobre
    counterPartyId?: string   // ID de counterparty en Cobre
  },
  autocoreInfo: {
    id: number                // ID de agencia en Autocore
  },
  empresa: boolean,           // Default: false
  isActive: boolean,          // Default: true
  usuarios: ObjectId[],       // Referencias a User
  userLimit: number,          // Default: 1, min: 1, max: 100
  permisoCartera: boolean,    // Default: false
  politicasAgencia: string,   // Default: ''
  maarlabApiKey: string,      // Bearer token MaarLab por agencia, default: ''
  createdAt: Date,
  updatedAt: Date
}
```

---

### **Reserva (Reserva Hotelera)**

```typescript
{
  _id: ObjectId,
  userId: ObjectId,           // Referencia a User, index
  agenciaId: ObjectId,        // Referencia a Agencia, index
  hotel: string,              // Nombre del hotel, trim, 1-200 chars, index
  cantidadHabitaciones: number, // 1-100, entero
  origenIata: string,
  mascotas: boolean,
  mascotasNumber: number,
  total: number,              // > 0
  totalMitad: number,         // >= 0, default: 0
  adicionCena: boolean,       // Default: false
  adicionAlmuerzo: boolean,   // Default: false
  pagadoPrimeraMitad: boolean, // Default: false
  planAlimentario: string,    // Default: ''
  infoTransporte?: {
    numeroVuelo: string,
    numeroVueloSalida?: string,
    aerolinea: string,
    tipoRecogida: number,     // Enum ValidTipoRecogida
    firstContactNumber: string,
    secondContacNumber?: string,
    cantidadPersonas: number
  },
  infoToures?: {
    nombres: string[],
    firstContactNumber: string,
    secondContacNumber?: string
  },
  reteFuente: { porcentaje: number, resultado: number },  // Default: {0, 0}
  reteIva: { porcentaje: number, resultado: number },      // Default: {0, 0}
  reteIca: { porcentaje: number, resultado: number },      // Default: {0, 0}
  exentoIva: boolean,         // Default: false
  status: ValidPaymentStatus, // 0:espera, 1:proceso, 2:rejected, 3:total, 4:cancelado, 5:mitad, 6:abonada
  cancelInProgress: boolean,  // Default: false, index
  cancelRequestedAt?: Date,   // Index
  cancelProcessedAt?: Date,
  cancelOpId?: string,
  asistentes: [{              // Array de asistentes
    fullName: string,
    tipoDocumento: 'CC' | 'NIT' | 'CE' | 'PA',
    documento: string,
    telefono: string,
    email: string
  }],
  titularInfo: {
    firstName: string,
    lastName: string,
    tipoDocumento: string,
    documento: string,
    fechaNacimiento: string
  },
  reservation: {              // Informacion de la reserva Autocore
    source_of_bussiness: string,
    adults: string,
    checkin: string,
    checkout: string,
    children: string,
    children_ages: string,
    city: string,
    country: string,
    currency: string,
    email: string,
    telephone: string,
    firstName: string,
    lastName: string,
    nights: string,
    notes: string,
    rooms: string,
    roomsData: [{
      nombreHabitacion: string,
      adults: string,
      children: string,
      children_ages: string,
      checkin: string,
      checkout: string,
      currency: string,
      id: string,
      quantity: string,
      rateId: string,
      unitaryPrice: number
    }]
  },
  reservaChatbotId: string,   // ID en Autocore, unique index
  paymenIds: string[],        // IDs de pagos
  fechaLimitePago: string,    // Index
  fechaLimitePago2: string,   // Index
  notasSuperAdmin: string,    // Default: ''
  notasagencias: string,      // Default: ''
  linkInfo: {
    link: string,
    expirationDate: string,
    idLinkPago: string
  },
  linksHistory: [{            // Historial de links de pago
    id: string,
    typeOfPayment: string,
    state: number,
    fecha: Date
  }],
  vuelo: [{                   // Vuelos MaarLab asociados
    packageId: string,
    respuestaMaarLab: object,
    createdAt: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

**Indices compuestos:**
- `{ userId: 1, status: 1, createdAt: -1 }`
- `{ agenciaId: 1, status: 1, createdAt: -1 }`
- `{ reservaChatbotId: 1 }` (unique)
- `{ fechaLimitePago: 1, status: 1 }`
- `{ status: 1, createdAt: -1 }`
- `{ cancelInProgress: 1, cancelRequestedAt: 1 }`
- `{ createdAt: -1 }`

---

### **Cotizacion**

```typescript
{
  _id: ObjectId,
  userId: ObjectId,           // Referencia a User, index
  agenciaId: ObjectId,        // Referencia a Agencia, index
  hotel: string,              // Index
  cantidadHabitaciones: number,
  origenIata: string,
  mascotas: boolean,
  mascotasNumber: number,
  total: number,
  markup: number,             // Min: 0
  porcentajemarkup: number,   // Min: 0
  totalMitad: number,         // Default: 0
  adicionCena: boolean,       // Default: false
  adicionAlmuerzo: boolean,   // Default: false
  planAlimentario: string,    // Default: ''
  infoTransporte?: { ... },   // Mismo formato que Reserva
  infoToures?: { ... },       // Mismo formato que Reserva
  reteFuente: { porcentaje: number, resultado: number },
  reteIva: { porcentaje: number, resultado: number },
  reteIca: { porcentaje: number, resultado: number },
  exentoIva: boolean,         // Default: false
  status: CotizacionStatus,   // 0:EN_ESPERA, 1:ACEPTADA, 2:RECHAZADA, 3:CONVERTIDA_RESERVA
  asistentes: [{              // Mismo formato que Reserva
    fullName: string,
    tipoDocumento: string,
    documento: string,
    telefono: string,
    email: string
  }],
  titularInfo: { ... },       // Mismo formato que Reserva
  reservation: { ... },       // Mismo formato que Reserva (IreservaInfoBd)
  cotizacionChatbotId: string, // Index
  fechaLimiteRespuesta: string, // Index
  notasSuperAdmin: string,    // Default: ''
  landingUrl: string,         // Index
  landingHtml: string,        // Default: ''
  pdfUrl: string,             // Default: ''
  pdfCloudinaryId: string,    // Default: ''
  tokenAcceso: string,        // Index, unique
  fechaAprobacion: Date,      // Default: null
  fechaRechazo: Date,         // Default: null
  motivoRechazo: string,      // Default: ''
  reservaId: ObjectId,        // Referencia a Reserva, default: null
  createdAt: Date,
  updatedAt: Date
}
```

**Indices compuestos:**
- `{ agenciaId: 1, createdAt: -1 }`
- `{ userId: 1, createdAt: -1 }`
- `{ tokenAcceso: 1 }` (unique)
- `{ status: 1, createdAt: -1 }`
- `{ agenciaId: 1, status: 1, createdAt: -1 }`

---

### **BookingPersona (Reserva Directa para Personas)**

```typescript
{
  _id: ObjectId,
  hotel: string,              // Index
  cantidadHabitaciones: number,
  origenIata: string,
  mascotas: boolean,
  mascotasNumber: number,
  total: number,
  adicionCena: boolean,       // Default: false
  adicionAlmuerzo: boolean,   // Default: false
  pagadoPrimeraMitad: boolean, // Default: false
  planAlimentario: string,    // Default: ''
  exentoIva: boolean,         // Default: false
  status: ValidPaymentStatus, // Mismo enum que Reserva
  titularInfo: { ... },       // Mismo formato que Reserva
  reservation: { ... },       // Mismo formato que Reserva (IreservaInfoBd)
  reservaChatbotId: string,   // Index
  paymenIds: string[],
  fechaLimitePago: string,    // Index
  fechaLimitePago2: string,   // Index
  linkInfo: {
    link: string,
    expirationDate: string,
    idLinkPago: string
  },
  linksHistory: [{
    id: string,
    typeOfPayment: string,
    state: number,
    fecha: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

### **PaymentPending (Pagos Pendientes - Booking Personas)**

```typescript
{
  _id: ObjectId,
  payment_code: string,       // Unico, index
  external_ref_id: string,
  status: PaymentStatus,      // 'pending' | 'paid' | 'rejected' | 'cancelled'
  amount: number,
  currency: string,
  transaction_id?: string,
  paid_at?: Date,
  hotel_id?: string,
  reservation_data?: any,     // Datos para crear reserva automaticamente
  reserva_id?: string,        // ID de reserva creada
  reserva_creada?: boolean,   // Default: false
  createdAt: Date,
  updatedAt: Date
}
```

**Coleccion:** `payment_pending_personas`

---

### **Integration (Integracion Externa)**

```typescript
{
  _id: ObjectId,
  name: string,               // Unico, lowercase, index
  apiKey: string,             // Unico, generado con crypto, index
  secretKey: string,          // Hasheado con bcrypt
  isActive: boolean,          // Default: false
  roles: string[],            // Enum ValidIntegrationsRoles
  createdAt: Date,
  updatedAt: Date
}
```

---

### **Evento (Evento/Convencion)**

```typescript
{
  _id: ObjectId,
  userId: ObjectId,           // Referencia a User, index
  agenciaId: ObjectId,        // Referencia a Agencia, index
  nameEvento: string,         // Lowercase, index
  tipoEvento: TipoEvento,    // Enum numerico, index
  nombreOrganizador: string,  // Lowercase, index
  telefonoOrganizador: string, // Index
  emailOrganizador: string,   // Index
  cantidadAsistentes: number,
  fechaInicioEvento: Date,
  fechaFinalEvento: Date,
  horarioEvento: [{           // Horarios por dia
    fechaInicio: Date,
    fechaFinal: Date,
    cantidadAsistenteDia: number
  }],
  flexibilidadEvento: boolean, // Default: false
  tipoAcomodacion: TipoAcomodacion, // Enum numerico
  alimentacion: boolean,      // Default: false
  alimentosBebidas: {
    estacionCafe: boolean,    // Default: false
    coffeBreak: boolean,      // Default: false
    desayuno: boolean,        // Default: false
    almuerzo: boolean,        // Default: false
    cena: boolean             // Default: false
  },
  audiovisuales: boolean,     // Default: false
  itemsAudiovisuales: string[], // Default: []
  decoracion: boolean,        // Default: false
  decoracionDescripcion: string, // Default: ''
  alojamiento: boolean,       // Default: false
  observaciones: string,      // Default: ''
  createdAt: Date,
  updatedAt: Date
}
```

---

### **OtpVerification (Verificacion OTP)**

```typescript
{
  _id: ObjectId,
  otp: string,                // Codigo OTP (6 digitos)
  expiresAt: Date,
  createdAt: Date
}
```

---

### **RefreshToken (Token de Actualizacion)**

```typescript
{
  _id: ObjectId,
  userId: ObjectId,           // Referencia a User
  token: string,              // UUID
  expiresAt: Date,
  createdAt: Date
}
```

---

## Autenticacion y Autorizacion

### **Roles del Sistema**

```typescript
enum ValidRoles {
  admin = 'admin',
  user = 'user',
  superAdmin = 'super-admin',
  eventosSuperAdmin = 'eventos-super-admin'
}
```

### **Roles de Integraciones**

```typescript
enum ValidIntegrationsRoles {
  autocoreProd = 'autocore-prod',
  autodoreDev = 'autocore-dev'
}
```

### **Flujo de Autenticacion JWT**

```
1. Cliente hace POST /auth/sign-in
   Body: { email, password }
    |
2. AuthService valida credenciales (bcrypt)
    |
3. Si OTP NO esta omitido -> generar y enviar OTP
    |
4. Cliente envia POST /auth/validate-otp
   Body: { email, otp }
    |
5. AuthService genera JWT + Refresh Token
    |
6. Response: {
     token: "eyJhbGc...",
     refreshToken: "uuid-v4...",
     user: { id, email, fullName, role, agencia }
   }
```

### **Guards Implementados**

#### **1. Auth Guard (JWT)**
```typescript
@Auth()
// Requiere token JWT valido en header Authorization: Bearer {token}
```

#### **2. User Role Guard**
```typescript
@Auth(ValidRoles.admin, ValidRoles.superAdmin)
// Requiere JWT + rol especifico
```

#### **3. API Key Guard**
```typescript
@ApiKeyProtected(ValidIntegrationsRoles.autocoreProd)
// Requiere API Key en header + roles de integracion
```

#### **4. Static Token Guard**
```typescript
@StaticTokenAuth()
// Requiere token estatico en header (booking-personas)
```

### **Decoradores Personalizados**

```typescript
@GetUser() user: User              // Obtener usuario autenticado completo
@GetUser('_id') id: string         // Obtener propiedad especifica
@GetUser('agencia') agencia: Types.ObjectId

@Auth(...roles: ValidRoles[])      // JWT + roles
@ApiKeyProtected(...roles)         // API Key + roles de integracion
@StaticTokenAuth()                 // Token estatico
@GetIntegration('roles') roles     // Obtener datos de integracion
@RoleProtected(...roles)           // Solo setear metadata de roles
```

---

## Flujos de Negocio Principales

### **1. Flujo de Creacion de Reserva**

```
1. Consultar Disponibilidad
   POST /reservas/disponibilidad
   - Enviar layout (adultos, ninos)
   - Autocore retorna hoteles disponibles
    |
2. Cliente selecciona hotel y habitacion
   - Obtiene IDs de room y rate
    |
3. Crear Reserva
   POST /reservas/reservar?hotelId={id}
   - Validar hotelId contra constantes (ParseHotelIdPipe)
   - Validar fechas checkin/checkout (ParseCheckinCheckoutPipe)
   - Crear reserva en Autocore
   - Guardar en BD local
   - Actualizar usuario (push reserva)
    |
4. Generar Link de Pago
   POST /reservas/generate-link
   - Crear counterparty en Cobre
   - Generar link de pago
   - Retornar URL de pago
    |
5. Pago (alternativas)
   a) Link de pago (Cobre webhook -> POST /reservas/change-status)
   b) Billetera single: POST /reservas/pago-billetera-single
   c) Billetera compuesto: POST /reservas/pago-billetera-compuesto
```

---

### **2. Flujo de Cotizacion con Conversion Automatica**

```
1. Agencia Crea Cotizacion
   POST /cotizaciones o POST /cotizaciones/from-disponibilidad
   - Genera token de acceso unico (UUID)
   - Genera landing URL y HTML
   - Status: EN_ESPERA (0)
    |
2. Cliente Recibe Landing Page
   GET /cotizaciones/public/token/:tokenAcceso
   - Ve detalles de la cotizacion
   - Boton: Aceptar / Rechazar
    |
3A. Cliente Acepta
    POST /cotizaciones/public/responder/:tokenAcceso
    Body: { respuesta: 'ACEPTAR' }
    - Status: ACEPTADA (1)
    - Inicia conversion automatica a reserva
    |
3B. Cliente Rechaza
    POST /cotizaciones/public/responder/:tokenAcceso
    Body: { respuesta: 'RECHAZAR', motivo }
    - Status: RECHAZADA (2)
    |
4. Conversion Automatica (si aceptada)
   - Buscar Hotel ID por nombre (exacta o parcial)
   - Construir layout
   - Consultar disponibilidad (Autocore, try/catch)
   - Validar disponibilidad y precios (variacion < 1%)
   - Crear reserva en Autocore
   - Crear reserva en BD local
   - Actualizar usuario
   - Actualizar cotizacion -> status: CONVERTIDA_RESERVA (3)
```

---

### **3. Flujo de Booking Personas**

```
1. Consultar Disponibilidad
   POST /booking-personas/disponibilidad
   Auth: Static Token
    |
2. Generar Link de Pago
   POST /booking-personas/generar-link-pago?hotelId={id}
   - Crea PaymentPending con status PENDING
   - Genera link de pago Autocore
    |
3. Cliente Paga
   Webhook: POST /booking-personas/change-status
   - Actualiza PaymentPending.status -> PAID
    |
4. Crear Reserva
   POST /booking-personas/reservar?hotelId={id}&paymentCode={code}
   - Verifica que el pago fue completado
   - Crea reserva en Autocore
   - Guarda BookingPersona en BD
```

---

### **4. Flujo de Busqueda de Vuelos (Amadeus)**

```
1. Cliente Busca Vuelos
   POST /vuelos/disponibilidad
   Body: { originLocationCode, destinationLocationCode, departureDate, adults, ... }
    |
2. Autenticacion con Amadeus (OAuth2, token cacheado)
    |
3. Buscar Ofertas de Vuelos (GET /v2/shopping/flight-offers)
    |
4. Enriquecer Datos con Nombres de Ciudades
    |
5. Retornar Ofertas Enriquecidas
```

---

### **5. Flujo de Vuelos MaarLab**

```
1. Buscar Disponibilidad
   POST /vuelos/maarlab/disponibilidad
   Auth: JWT (Bearer token de agencia.maarlabApiKey)
    |
2. Crear Paquete
   POST /vuelos/maarlab/paquete
    |
3. Agregar Extras/Equipaje
   POST /vuelos/maarlab/extras
   GET /vuelos/maarlab/equipaje
    |
4. Reservar Paquete
   POST /vuelos/maarlab/reservar
    |
5. Obtener Token de Pago
   GET /vuelos/maarlab/token-pago
    |
O: Proceso Completo
   POST /vuelos/maarlab/search-engine/complete-process
   POST /vuelos/maarlab/travel-agency/complete-process
   POST /vuelos/maarlab/v1/travel-agency/complete-process
```

---

### **6. Flujo de Bot de Reservas Pendientes**

```
1. Cron Job (diario a las 8:00 AM) o ejecucion manual
   POST /bot-reservas-pendientes/ejecutar-manualmente (superAdmin)
    |
2. Buscar Reservas Pendientes de Pago
   - Filtrar por fechas limite y estados
    |
3. Generar Reporte Excel (ExcelJS)
    |
4. Enviar Email con Adjunto
    |
5. Log de exito
```

---

## Variables de Entorno

### **Archivo `.env` Requerido**

```env
# SERVER
PORT=3000

# DATABASE
MONGO_URL=mongodb://localhost:27017/agencias

# JWT AUTHENTICATION
JWT_SECRET=your-super-secret-jwt-key

# COBRE (Pagos)
COBRE_API_URL=https://api.cobredigital.com
COBRE_USER_ID=your-cobre-user-id
COBRE_SECRET=your-cobre-secret
COBRE_AUTH_STRING=your-auth-string
COBRE_API_KEY=your-cobre-api-key

# CLOUDINARY (Archivos)
CLOUDINARY_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# EMAIL (SendGrid)
SENDGRID_API_KEY=SG.your-sendgrid-api-key

# EMAIL (Nodemailer)
SENDER_EMAIL=noreply@youragency.com
EMAIL_APP_PASSWORD=your-email-app-password

# GOOGLE GMAIL API
GOOGLE_GMAIL_API_KEY=your-gmail-access-token
GOOGLE_GMAIL_URL=https://gmail.googleapis.com/gmail/v1/users/me/messages/send
GOOGLE_GMAIL_CLIENT_ID=your-client-id
GOOGLE_GMAIL_CLIENT_SECRET=your-client-secret
GOOGLE_GMAIL_REFRESH_TOKEN=your-refresh-token

# AUTOCORE (PMS Hotelero) - PRODUCCION
AUTOCORE_URL=https://api.autocore.com
AUTOCORE_ACCESS_KEY=your-autocore-access-key
AUTOCORE_SECRET_KEY=your-autocore-secret-key

# AUTOCORE - DESARROLLO (opcionales)
AUTOCORE_URL_DEV=https://dev-api.autocore.com
AUTOCORE_ACCESS_KEY_DEV=your-dev-access-key
AUTOCORE_SECRET_KEY_DEV=your-dev-secret-key

# MY TOOL (Interno)
MY_TOOL_EMAIL=admin@mytool.com
MY_TOOL_CLAVE=your-mytool-password

# APIs por Hotel
API_AIXO=https://api.hotel-aixo.com
API_AZUAN=https://api.hotel-azuan.com
API_RODADERO=https://api.hotel-rodadero.com
API_AVEXI=https://api.hotel-avexi.com
API_BOCAGRANADE=https://api.hotel-bocagrande.com
API_ABI=https://api.hotel-abi.com
API_MADISSON=https://api.hotel-madisson.com
API_WINDSOR=https://api.hotel-windsor.com
API_MARINA=https://api.hotel-marina.com
API_AXIS=https://api.hotel-axis.com

# AMADEUS (Vuelos)
AMADEUS_API_KEY=your-amadeus-api-key
AMADEUS_API_SECRET=your-amadeus-api-secret
AMADEUS_BASE_URL=https://api.amadeus.com

# BOOKING PERSONAS
BOOKING_PERSONAS_TOKEN=your-static-token

# MAARLAB / OCEANFLIGHTS
MAARLAB_BASE_URL=https://api.maarlab.com
MAARLAB_AUTH_TOKEN=                  # Legado, no usar
```

---

## API Endpoints

### **Base URL**
```
http://localhost:3000/agencias/v1/
```

### **Swagger/OpenAPI**
```
http://localhost:3000/agencias/v1/api-docs
```

---

### **Autenticacion** (`/auth`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/auth/sign-up/:agenciaId` | Crear usuario asociado a agencia | No (throttle: 3/min) |
| POST | `/auth/register-user` | Registrar usuario en agencia | JWT (admin, superAdmin) |
| POST | `/auth/sign-in` | Iniciar sesion | No (throttle: 5/min) |
| POST | `/auth/validar-token` | Validar token JWT completo | No |
| POST | `/auth/validate-access-token` | Validar access token | No |
| POST | `/auth/refresh-token` | Renovar token JWT | No (throttle: 10/min) |
| POST | `/auth/validate-otp` | Validar codigo OTP | No (throttle: 5/min) |
| POST | `/auth/request-password-change` | Solicitar cambio de contrasena | No (throttle: 3/min) |
| PATCH | `/auth/new-credentials` | Cambiar contrasena | JWT |
| PATCH | `/auth/switch-activation-status/:userId` | Activar/desactivar usuario | JWT (admin, superAdmin) |
| GET | `/auth/getAllUsers` | Listar todos los usuarios | JWT (superAdmin) |
| PATCH | `/auth/politicas-agencia` | Actualizar politicas de agencia | JWT |

---

### **Reservas** (`/reservas`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/reservas/disponibilidad` | Consultar disponibilidad | JWT |
| POST | `/reservas/disponibilidad-debug` | Disponibilidad con debug | JWT |
| POST | `/reservas/reservar?hotelId={id}` | Crear reserva | JWT |
| PUT | `/reservas/editar-reserva/:reservaId` | Editar reserva | JWT |
| DELETE | `/reservas/cancelar-reserva` | Cancelar reserva | JWT |
| POST | `/reservas/change-status` | Webhook cambio estado pago | No |
| GET | `/reservas/reservas-by-user` | Reservas del usuario | JWT |
| GET | `/reservas/reservas-by-agencia` | Reservas de la agencia | JWT (admin) |
| POST | `/reservas/generate-link` | Generar link de pago | JWT |
| POST | `/reservas/pago-billetera-single` | Pagar con billetera | JWT |
| POST | `/reservas/pago-billetera-compuesto` | Pago compuesto billetera | JWT |
| GET | `/reservas/buscar/chatbot-id?reservaChatbotId=` | Buscar por chatbot ID | JWT |
| GET | `/reservas/buscar/agente?nombre=` | Buscar por nombre agente | JWT |
| GET | `/reservas/buscar/agencia?nombre=` | Buscar por nombre agencia | JWT |
| GET | `/reservas/buscar/huesped?nombre=` | Buscar por nombre huesped | JWT |
| GET | `/reservas/buscar/estado?status=` | Buscar por estado | JWT |
| GET | `/reservas?page=&all=&hotel=&nombreAgencia=&fechaDesde=&fechaHasta=` | Todas las reservas | JWT (superAdmin) |
| DELETE | `/reservas/cancelar-reserva-admin/:reservaId` | Cancelar reserva (admin) | JWT (superAdmin) |
| PUT | `/reservas/status/:reservaId` | Actualizar status manual | JWT (superAdmin) |
| PUT | `/reservas/fechas-pago/:reservaId` | Actualizar fechas de pago | JWT (admin, superAdmin) |

---

### **Cotizaciones Privadas** (`/cotizaciones`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/cotizaciones` | Crear cotizacion | JWT |
| POST | `/cotizaciones/from-disponibilidad` | Crear desde disponibilidad | JWT |
| GET | `/cotizaciones?page=&limit=` | Listar cotizaciones | JWT |
| GET | `/cotizaciones/estadisticas` | Estadisticas | JWT |
| GET | `/cotizaciones/debug-user` | Debug usuario | JWT |
| GET | `/cotizaciones/test-disponibilidad-directa` | Test disponibilidad | JWT |
| GET | `/cotizaciones/:id` | Obtener por ID | JWT |
| GET | `/cotizaciones/token/:tokenAcceso` | Obtener por token | JWT |
| POST | `/cotizaciones/responder/:tokenAcceso` | Responder cotizacion | JWT |
| POST | `/cotizaciones/pdf` | Generar PDF | JWT |
| POST | `/cotizaciones/convertir-reserva/:id` | Convertir a reserva | JWT |
| POST | `/cotizaciones/test-validation` | Test validacion DTO | JWT |
| PATCH | `/cotizaciones/:id` | Actualizar | JWT |
| DELETE | `/cotizaciones/:id` | Eliminar | JWT |

---

### **Cotizaciones Publicas** (`/cotizaciones/public`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/cotizaciones/public/token/:tokenAcceso` | Ver cotizacion por token | No |
| GET | `/cotizaciones/public/:id` | Ver cotizacion por ID | No |
| POST | `/cotizaciones/public/responder/:tokenAcceso` | Aceptar/Rechazar | No |

---

### **Vuelos - Amadeus** (`/vuelos`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/vuelos/test` | Verificar modulo | No |
| GET | `/vuelos/test-auth` | Probar auth Amadeus | No |
| GET | `/vuelos/ubicaciones` | Buscar ubicaciones | No |
| GET | `/vuelos/aeropuertos/iata/:iataCode` | Buscar por IATA | No |
| GET | `/vuelos/ciudades` | Buscar ciudades | No |
| GET | `/vuelos/ciudades/buscar` | Buscar ciudades avanzado | No |
| POST | `/vuelos/disponibilidad-test` | Test disponibilidad | No |
| POST | `/vuelos/disponibilidad` | Buscar vuelos | No |
| POST | `/vuelos/reservar` | Crear orden de vuelo | No |
| GET | `/vuelos/reservas/:flightOrderId` | Consultar orden | No |
| DELETE | `/vuelos/reservas/:flightOrderId` | Cancelar orden | No |

---

### **Vuelos - MaarLab** (`/vuelos/maarlab`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/vuelos/maarlab/disponibilidad` | Buscar disponibilidad | JWT |
| POST | `/vuelos/maarlab/paquete` | Crear paquete | JWT |
| GET | `/vuelos/maarlab/equipaje` | Consultar equipaje | JWT |
| POST | `/vuelos/maarlab/extras` | Agregar extras | JWT |
| DELETE | `/vuelos/maarlab/extras` | Eliminar extras | JWT |
| POST | `/vuelos/maarlab/reservar` | Reservar paquete | JWT |
| GET | `/vuelos/maarlab/token-pago` | Token de pago | JWT |
| GET | `/vuelos/maarlab/paquete` | Consultar paquete | JWT |
| GET | `/vuelos/maarlab/contrato-atol` | Contrato ATOL | JWT |
| POST | `/vuelos/maarlab/search-engine/complete-process` | Proceso completo SE | JWT |
| POST | `/vuelos/maarlab/travel-agency/complete-process` | Proceso completo TA | JWT |
| POST | `/vuelos/maarlab/v1/travel-agency/complete-process` | Proceso completo TA v1 | JWT |
| GET | `/vuelos/maarlab/search-engine/mapping-external-id/:id` | Mapping ID externo | JWT |

---

### **Agencias** (`/agencias`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/agencias/create` | Crear agencia | No |
| POST | `/agencias/recharge-wallet` | Recargar billetera | JWT |
| GET | `/agencias/obtener-saldo` | Obtener saldo | JWT |
| GET | `/agencias?page=&limit=` | Listar agencias | JWT (superAdmin) |
| GET | `/agencias/getByProperty?search=` | Buscar por propiedad | JWT (superAdmin) |
| PATCH | `/agencias/update/:id` | Actualizar agencia | JWT (superAdmin) |
| PATCH | `/agencias/switch-activation-agencia/:agenciaId` | Activar/desactivar | JWT (superAdmin) |
| GET | `/agencias/agencies-by-term?search=` | Agencias por termino | No |
| GET | `/agencias/agencias-con-reserva` | Agencias con reserva | JWT (superAdmin) |
| GET | `/agencias/:id/politicas` | Politicas de agencia | JWT |
| GET | `/agencias/:agenciaId/nombre` | Nombre de agencia | JWT |

---

### **Booking Personas** (`/booking-personas`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/booking-personas/disponibilidad` | Consultar disponibilidad | Static Token |
| POST | `/booking-personas/generar-link-pago?hotelId=` | Generar link de pago | Static Token |
| POST | `/booking-personas/reservar?hotelId=&paymentCode=` | Crear reserva | Static Token |
| POST | `/booking-personas/change-status` | Webhook estado de pago | No |

---

### **Integraciones** (`/integrations`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/integrations/create` | Crear integracion | No |
| POST | `/integrations/disponibilidad` | Consultar disponibilidad | API Key |

---

### **Bot Reservas Pendientes** (`/bot-reservas-pendientes`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/bot-reservas-pendientes/ejecutar-manualmente` | Ejecutar bot | JWT (superAdmin) |
| POST | `/bot-reservas-pendientes/estado` | Estado del bot | JWT (superAdmin) |
| POST | `/bot-reservas-pendientes/diagnostico` | Diagnostico | JWT (superAdmin) |

---

### **Files** (`/files`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/files/user-profile` | Subir imagen de perfil | JWT |

---

### **My Tool** (`/my-tool`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| GET | `/my-tool/reservas-info` | Info de reservas | No |

---

### **Notificaciones** (`/notificaciones`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/notificaciones/reservas` | Notificacion de pago | No |

---

### **Eventos** (`/eventos`)

| Metodo | Endpoint | Descripcion | Auth |
|--------|----------|-------------|------|
| POST | `/eventos/create` | Crear reserva de evento | JWT |
| GET | `/eventos` | Listar eventos | JWT (superAdmin, eventosSuperAdmin) |

---

### **Cloudinary** (`/cloudinary`)

El controlador esta vacio. La logica de Cloudinary se usa internamente desde otros servicios (cotizaciones, files).

---

## Instalacion y Configuracion

### **Requisitos Previos**
- Node.js v20+
- MongoDB v6+
- npm v9+

### **Instalacion**

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-organizacion/agencias-api.git
cd agencias-api

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
# Crear archivo .env con las variables listadas arriba

# 4. Compilar proyecto
npm run build

# 5. Iniciar servidor
npm run start:dev  # Desarrollo con hot-reload
npm run start:prod # Produccion
```

### **Verificacion de Instalacion**

```bash
# Verificar que el servidor esta corriendo
curl http://localhost:3000/agencias/v1/vuelos/test

# Acceder a Swagger
# http://localhost:3000/agencias/v1/api-docs
```

---

## Manejo de Errores

### **ErrorManager (Centralizado)**
Cada servicio usa `ErrorManager` para manejar y propagar errores de forma consistente.

### **Vuelos: ErrorHandlerService + Interceptor + Filter**
El modulo de vuelos tiene un sistema propio de manejo de errores con interceptor y filtro que estandariza las respuestas de error.

### **Error 500 de Autocore durante disponibilidad**
El sistema implementa `try-catch` para permitir la creacion de reserva sin verificacion cuando Autocore falla. Se registra log de advertencia y continua.

### **Hotel no encontrado**
Busqueda flexible por nombre: primero exacta, luego parcial (includes).

### **Variacion de precio en conversion de cotizacion**
Se bloquea la conversion y se notifica si hay una variacion >= 1% en el precio.

---

## Seguridad

### **Medidas Implementadas**

1. **Hashing de Contrasenas:** bcrypt con 10 rounds
2. **JWT:** Tokens firmados con secret key
3. **Refresh Tokens:** UUID v4 con expiracion
4. **Validacion de DTOs:** class-validator + class-transformer con whitelist y forbidNonWhitelisted
5. **Guards de Roles:** Proteccion de endpoints por rol
6. **API Keys Hasheadas:** bcrypt para integrations
7. **Static Token Auth:** Para booking-personas
8. **CORS Configurado:** origin: true, credentials: true
9. **Rate Limiting Global:** ThrottlerModule con 3 niveles:
   - Short: 100 req / 60s
   - Medium: 500 req / 10min
   - Long: 2000 req / 1h
10. **Rate Limiting por Endpoint:** Throttle personalizado en auth (login, registro, OTP)
11. **Sanitizacion de Inputs:** whitelist + forbidNonWhitelisted + transform
12. **Swagger con Auth:** Bearer auth configurable en Swagger UI

---

## Logging

El sistema usa **Pino** como logger estructurado (via `nestjs-pino`):

- **Desarrollo:** pino-pretty con colores y formato legible
- **Produccion:** JSON estructurado (nivel: info)
- **Serializers personalizados:** para req, res, err
- **Auto-logging:** ignora health checks y favicon
- **Contexto HTTP** automatico en cada request

---

## Scripts NPM

```bash
# Desarrollo
npm run start:dev       # Inicia con hot-reload
npm run start:debug     # Inicia con debugger

# Produccion
npm run build           # Compila TypeScript
npm run start:prod      # Inicia version compilada

# Testing
npm run test            # Unit tests
npm run test:watch      # Tests en modo watch
npm run test:cov        # Coverage report
npm run test:e2e        # E2E tests

# Linting y Formateo
npm run lint            # ESLint con fix
npm run format          # Prettier

# Migraciones / Scripts
npm run migrate:maarlab-api-key       # Migrar API keys MaarLab
npm run script:register-agencias-maarlab  # Registrar agencias en MaarLab
```

---

## Contacto y Soporte

Para preguntas tecnicas o soporte, contactar a:
- **Email:** innovacion@gehsuites.com

---

## Changelog

### **v0.0.1**
- Sistema de autenticacion JWT completo con OTP
- Modulo de reservas con Autocore
- Modulo de cotizaciones con conversion automatica
- Generacion de PDFs con Puppeteer
- Integracion con Amadeus para vuelos
- Integracion con MaarLab/OceanFlights para vuelos
- Sistema de pagos con Cobre
- Bot automatizado de reportes
- Gestion multi-agencia
- Upload de archivos a Cloudinary
- Sistema de notificaciones (SendGrid + Nodemailer + Gmail API)
- Booking personas (reservas directas sin agencia)
- Swagger/OpenAPI documentacion integrada
- Rate limiting global con Throttler
- Logging estructurado con Pino
- Gestion de eventos/convenciones

---

**Ultima actualizacion:** Abril 15, 2026
**Version del documento:** 2.0.0
