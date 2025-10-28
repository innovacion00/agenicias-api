# 📚 Documentación Técnica - Agencias API

## 📋 Índice

1. [Descripción General](#descripción-general)
2. [Stack Tecnológico](#stack-tecnológico)
3. [Arquitectura del Sistema](#arquitectura-del-sistema)
4. [Módulos Principales](#módulos-principales)
5. [Integraciones Externas](#integraciones-externas)
6. [Modelos de Datos](#modelos-de-datos)
7. [Autenticación y Autorización](#autenticación-y-autorización)
8. [Flujos de Negocio Principales](#flujos-de-negocio-principales)
9. [Variables de Entorno](#variables-de-entorno)
10. [API Endpoints](#api-endpoints)
11. [Instalación y Configuración](#instalación-y-configuración)

---

## 📖 Descripción General

**Agencias API** es una plataforma backend desarrollada con NestJS para la gestión integral de agencias de viajes. El sistema permite:

- 🏨 **Gestión de Reservas Hoteleras** mediante integración con Autocore
- ✈️ **Búsqueda y Reserva de Vuelos** mediante integración con Amadeus
- 💰 **Sistema de Pagos** mediante integración con Cobre
- 📧 **Cotizaciones y Conversión Automática** a reservas
- 👥 **Gestión Multi-Agencia** con permisos y roles
- 📊 **Reportes Automatizados** de reservas pendientes
- 🔔 **Sistema de Notificaciones** por email

---

## 🛠️ Stack Tecnológico

### **Framework y Lenguajes**
- **Framework Backend:** NestJS v10.0.0
- **Lenguaje:** TypeScript v5.1.3
- **Runtime:** Node.js v20+

### **Base de Datos**
- **Base de Datos:** MongoDB v8.6.2
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
  "@nestjs/schedule": "^6.0.0"
}
```

#### **Autenticación y Seguridad**
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
  "@nestjs/axios": "^3.0.3",
  "axios": "^1.7.7",
  "@sendgrid/mail": "^8.1.5",
  "nodemailer": "^6.9.15"
}
```

#### **Procesamiento y Utilidades**
```json
{
  "puppeteer": "^24.23.0",
  "exceljs": "^4.4.0",
  "cloudinary": "^2.5.1",
  "uuid": "^10.0.0",
  "date-fns": "^4.1.0",
  "libphonenumber-js": "^1.11.19"
}
```

#### **Validación**
```json
{
  "class-validator": "^0.14.1",
  "class-transformer": "^0.5.1"
}
```

---

## 🏗️ Arquitectura del Sistema

### **Arquitectura por Capas**

```
┌─────────────────────────────────────────────┐
│          Controllers (HTTP Layer)           │
│  - Reciben requests HTTP                    │
│  - Validan DTOs                             │
│  - Retornan responses                       │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│          Services (Business Logic)          │
│  - Lógica de negocio                        │
│  - Orquestación de operaciones             │
│  - Transformación de datos                  │
└──────────────────┬──────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│     Repositories (Data Access Layer)        │
│  - Mongoose Models                          │
│  - Consultas a MongoDB                      │
│  - Gestión de transacciones                │
└─────────────────────────────────────────────┘
```

### **Estructura de Directorios**

```
src/
├── agencias/              # Módulo de gestión de agencias
├── auth/                  # Autenticación y autorización
├── bot-reservas-pendientes/ # Bot automatizado de reportes
├── cloudinary/            # Gestión de archivos en la nube
├── common/                # Recursos compartidos
│   ├── decorators/        # Decoradores personalizados
│   ├── dto/               # DTOs compartidos
│   ├── helpers/           # Funciones auxiliares
│   ├── interface/         # Interfaces compartidas
│   ├── pipes/             # Pipes de validación
│   └── services/          # Servicios compartidos
├── config/                # Configuración global
│   └── constants/         # Constantes del sistema
├── cotizaciones/          # Módulo de cotizaciones
├── eventos/               # Módulo de eventos
├── files/                 # Gestión de archivos
├── integrations/          # Integraciones externas
├── my-tool/               # Herramientas internas
├── notificaciones/        # Sistema de notificaciones
├── reservas/              # Módulo de reservas
└── vuelos/                # Módulo de vuelos (Amadeus)
```

---

## 📦 Módulos Principales

### **1. Auth Module** 🔐
**Responsabilidad:** Gestión de autenticación, autorización y usuarios.

**Componentes:**
- `AuthService`: Lógica de autenticación (login, registro, JWT)
- `AuthController`: Endpoints de autenticación
- `JwtStrategy`: Estrategia de validación JWT
- `ApiKeyGuard`: Guard para API Keys externas
- `UserRoleGuard`: Guard para roles de usuario

**Entidades:**
- `User`: Usuarios del sistema
- `OtpVerification`: Códigos OTP para verificación 2FA
- `RefreshToken`: Tokens de actualización

**Características:**
- ✅ Autenticación JWT
- ✅ Refresh tokens
- ✅ Verificación OTP (opcional por usuario)
- ✅ Roles y permisos
- ✅ Gestión de contraseñas (bcrypt)
- ✅ Cambio de contraseña con validación

---

### **2. Reservas Module** 🏨
**Responsabilidad:** Gestión completa del ciclo de vida de reservas hoteleras.

**Componentes:**
- `ReservasService`: Lógica de negocio de reservas
- `ReservasController`: Endpoints CRUD de reservas
- Integración con **Autocore** para disponibilidad y creación de reservas

**Entidades:**
- `Reserva`: Reserva hotelera completa

**Características:**
- ✅ Consulta de disponibilidad en tiempo real (Autocore)
- ✅ Creación de reservas con validación
- ✅ Actualización de reservas
- ✅ Cancelación y reembolsos
- ✅ Gestión de fechas límite de pago
- ✅ Cálculo de retenciones fiscales
- ✅ Soporte para mascotas, transporte y tours
- ✅ Planes alimentarios (desayuno, almuerzo, cena)

---

### **3. Cotizaciones Module** 💼
**Responsabilidad:** Gestión de cotizaciones y conversión automática a reservas.

**Componentes:**
- `CotizacionesService`: Lógica de cotizaciones
- `CotizacionesController`: Endpoints privados (autenticados)
- `CotizacionesPublicController`: Endpoints públicos (aceptar/rechazar)

**Entidades:**
- `Cotizacion`: Cotización con estados (pendiente, aceptada, rechazada, convertida)

**Características:**
- ✅ Generación de cotizaciones desde disponibilidad
- ✅ Generación de PDF con Puppeteer (sin botones)
- ✅ Landing page personalizada con token de acceso único
- ✅ Aceptación/Rechazo público mediante token
- ✅ **Conversión automática a reserva** tras aceptación:
  - Verifica disponibilidad en tiempo real
  - Valida variaciones de precio (≥1%)
  - Crea reserva en Autocore
  - Guarda reserva en BD local
  - Actualiza usuario y cotización
- ✅ Markup personalizado por agencia
- ✅ Upload de PDF a Cloudinary

**Flujo de Conversión:**
```
Cotización Aceptada
    ↓
Consultar Disponibilidad (Autocore)
    ↓
Validar Habitaciones Disponibles
    ↓
Validar Precio (variación < 1%)
    ↓
Crear Reserva en Autocore
    ↓
Crear Reserva en BD Local
    ↓
Actualizar Usuario (agregar reserva)
    ↓
Actualizar Cotización (status: CONVERTIDA_RESERVA)
```

---

### **4. Vuelos Module** ✈️
**Responsabilidad:** Búsqueda y reserva de vuelos mediante Amadeus.

**Componentes:**
- `VuelosService`: Orquestación de búsqueda de vuelos
- `AmadeusService`: Integración directa con API de Amadeus
- `FlightEnrichmentService`: Enriquecimiento de datos (nombres de ciudades)
- `VuelosController`: Endpoints de vuelos

**Características:**
- ✅ Búsqueda de ubicaciones (aeropuertos, ciudades)
- ✅ Búsqueda de vuelos por IATA
- ✅ Búsqueda de ofertas de vuelos
- ✅ Enriquecimiento con nombres de ciudades
- ✅ Creación de órdenes de vuelo (reservas)
- ✅ Autenticación OAuth2 con Amadeus

---

### **5. Agencias Module** 🏢
**Responsabilidad:** Gestión de agencias de viajes (mayoristas y minoristas).

**Componentes:**
- `AgenciasService`: Lógica de agencias
- `AgenciasController`: Endpoints CRUD

**Entidades:**
- `Agencia`: Agencia con información de Cobre y Autocore

**Características:**
- ✅ Categorías: Mayorista (1) o Minorista (0)
- ✅ Creación de agencia en Autocore y Cobre simultánea
- ✅ Gestión de saldo y billetera prepago
- ✅ Límite de usuarios por agencia
- ✅ Permisos de cartera
- ✅ Información de documentos (NIT, CC, CE, PA)
- ✅ Recarga de billetera

---

### **6. Common Module** 🧰
**Responsabilidad:** Servicios y utilidades compartidas.

**Servicios:**
- `HttpCustomService`: Cliente HTTP para integraciones externas
  - Autocore (reservas, disponibilidad, agencias)
  - Cobre (pagos, billeteras, links de pago)
- `SendEmailService`: Envío de emails (SendGrid + Nodemailer)

**Helpers:**
- `ErrorManager`: Manejo centralizado de errores
- `ConvertidorMoneda`: Conversión de divisas
- `getCellInfo`: Procesamiento de celdas Excel

---

### **7. Bot Reservas Pendientes Module** 🤖
**Responsabilidad:** Bot automatizado para reportes de reservas pendientes.

**Características:**
- ✅ Cron jobs programados con `@nestjs/schedule`
- ✅ Generación de reportes Excel (ExcelJS)
- ✅ Envío automático por email
- ✅ Filtros por estados de pago
- ✅ Cálculo de diferencias de fechas

---

### **8. Cloudinary Module** ☁️
**Responsabilidad:** Gestión de archivos en Cloudinary.

**Características:**
- ✅ Upload de imágenes (usuarios, agencias)
- ✅ Upload de PDFs (cotizaciones)
- ✅ Eliminación de recursos
- ✅ URLs firmadas y seguras

---

### **9. Notificaciones Module** 🔔
**Responsabilidad:** Sistema de notificaciones por email.

**Características:**
- ✅ Plantillas de email personalizadas
- ✅ Envío de confirmaciones de reserva
- ✅ Notificaciones de estado de pago
- ✅ Recordatorios automáticos

---

### **10. Eventos Module** 📅
**Responsabilidad:** Gestión de eventos y actividades.

**Características:**
- ✅ CRUD de eventos
- ✅ Vinculación con usuarios
- ✅ Fechas y horarios

---

### **11. Files Module** 📁
**Responsabilidad:** Procesamiento y gestión de archivos locales.

**Características:**
- ✅ Validación de archivos
- ✅ Procesamiento de imágenes
- ✅ Límites de tamaño

---

### **12. Integrations Module** 🔌
**Responsabilidad:** Gestión de integraciones externas mediante API Keys.

**Características:**
- ✅ Generación de API Keys para terceros
- ✅ Autenticación mediante API Key + Secret Key
- ✅ Endpoints públicos de disponibilidad
- ✅ Roles de integración (dev, prod)

---

## 🌐 Integraciones Externas

### **1. Autocore (PMS Hotelero)** 🏨

**Propósito:** Sistema de gestión hotelera para reservas, disponibilidad y pagos.

**Endpoints Utilizados:**
- `POST /v2/bookings/agencies/{category}/availability` - Consultar disponibilidad
- `POST /v2/bookings/hotel_id={id}` - Crear reserva
- `PUT /v2/bookings/chatbot/{chatbotId}` - Editar reserva
- `DELETE /v2/bookings/chatbot/{chatbotId}` - Cancelar reserva
- `POST /v2/agencies` - Crear agencia
- `GET/PUT /v2/preloaded-balance/agencies/{id}` - Gestión de billetera
- `POST /v2/links/schedule/` - Crear link de pago
- `POST /v2/links/preloaded-balance` - Pagar con billetera

**Autenticación:**
```typescript
headers: {
  'access-key': process.env.AUTOCORE_ACCESS_KEY,
  'secret-key': process.env.AUTOCORE_SECRET_KEY
}
```

**Flujo de Disponibilidad:**
```typescript
POST /v2/bookings/agencies/1/availability?checkin=2025-12-10&nights=2&city=CARTAGENA

Body:
{
  "layout": [
    { "adults": 2, "children_ages": [] }
  ]
}

Response:
[
  {
    "hotel_id": 13643,
    "hotel_name": "Hotel Marina",
    "available_rooms": [
      {
        "id": "83528",
        "name": "Habitacion Doble Standard",
        "rates": [
          { "id": "99092", "price": 230000, "currency": "COP" }
        ]
      }
    ]
  }
]
```

**Manejo de Errores:**
- Error 500: Se implementa `try-catch` para permitir la creación de reserva sin verificación cuando Autocore falla.
- El sistema registra un log de advertencia y continúa con la creación.

---

### **2. Cobre (Pasarela de Pagos)** 💳

**Propósito:** Gestión de pagos, billeteras y links de pago.

**Endpoints Utilizados:**
- `POST /v1/auth` - Generar token OAuth
- `POST /v1/accounts` - Crear bolcillo (billetera)
- `POST /v1/counterparties` - Crear counterparty (pagador)
- `POST /v1/money_movements` - Generar link de pago

**Autenticación:**
```typescript
POST /v1/auth
{
  "user_id": process.env.COBRE_USER_ID,
  "secret": process.env.COBRE_SECRET
}

Response:
{
  "access_token": "eyJhbGc...",
  "expires_in": 3600
}
```

**Flujo de Link de Pago:**
```
1. Generar Token OAuth
    ↓
2. Crear Bolcillo (si no existe)
    ↓
3. Crear CounterParty (información del pagador)
    ↓
4. Generar Money Movement (link de pago)
    ↓
5. Retornar URL de pago
```

---

### **3. Amadeus (Vuelos)** ✈️

**Propósito:** Búsqueda y reserva de vuelos internacionales.

**Endpoints Utilizados:**
- `POST /v1/security/oauth2/token` - Autenticación
- `GET /v1/reference-data/locations` - Buscar aeropuertos/ciudades
- `GET /v2/shopping/flight-offers` - Buscar ofertas de vuelos
- `POST /v1/booking/flight-orders` - Crear orden de vuelo (reserva)

**Autenticación:**
```typescript
POST /v1/security/oauth2/token
Headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
Body: {
  grant_type=client_credentials
  &client_id={AMADEUS_API_KEY}
  &client_secret={AMADEUS_API_SECRET}
}
```

**Búsqueda de Vuelos:**
```typescript
GET /v2/shopping/flight-offers?
  originLocationCode=BOG&
  destinationLocationCode=CTG&
  departureDate=2025-12-10&
  adults=1&
  currencyCode=COP
```

---

### **4. Cloudinary (Almacenamiento)** ☁️

**Propósito:** Almacenamiento de imágenes y PDFs.

**Recursos Almacenados:**
- Imágenes de usuarios
- Imágenes de agencias
- PDFs de cotizaciones

**Configuración:**
```typescript
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
```

**Carpetas:**
```
cloudinary/
├── users/              # Fotos de perfil
├── agencias/           # Logos de agencias
└── cotizaciones/       # PDFs de cotizaciones
```

---

### **5. SendGrid (Emails)** 📧

**Propósito:** Envío de emails transaccionales y notificaciones.

**Tipos de Emails:**
- Confirmaciones de reserva
- PDFs de cotizaciones
- Reportes automatizados (Excel)
- OTPs de verificación
- Cambios de contraseña

**Configuración:**
```typescript
import sgMail from '@sendgrid/mail';
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
```

---

### **6. My Tool (Integración Interna)** 🔧

**Propósito:** Herramientas internas de la organización.

**APIs por Hotel:**
```typescript
{
  API_AIXO: string,
  API_AZUAN: string,
  API_RODADERO: string,
  API_AVEXI: string,
  API_BOCAGRANADE: string,
  API_ABI: string,
  API_MADISSON: string,
  API_WINDSOR: string,
  API_MARINA: string,
  API_AXIS: string
}
```

---

## 🗄️ Modelos de Datos

### **User (Usuario)**

```typescript
{
  _id: ObjectId,
  email: string,              // Único, lowercase
  password: string,           // Hasheado con bcrypt
  telefono: string,
  fullName: string,           // Lowercase
  isActive: boolean,          // Default: true
  firstLog: boolean,          // Default: true
  role: string[],             // ['admin', 'user', 'superAdmin']
  imageUrl: string,
  agencia: ObjectId,          // Referencia a Agencia
  otpRef: ObjectId,           // Referencia a OtpVerification
  reservas: ObjectId[],       // Referencias a Reserva
  eventos: ObjectId[],        // Referencias a Evento
  settings: {
    omitirOtp: boolean        // Default: false
  },
  createdAt: Date,
  updatedAt: Date
}
```

---

### **Agencia (Agencia de Viajes)**

```typescript
{
  _id: ObjectId,
  emailContacto: string,      // Único
  telefonoContacto: string,
  fullName: string,           // Lowercase
  slug: string,               // Único, generado automáticamente
  saldo: number,              // Default: 0
  category: 0 | 1,            // 0: Minorista, 1: Mayorista
  documentInfo: {
    tipo: 'CC' | 'NIT' | 'CE' | 'PA',
    document: string          // Único
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
  userLimit: number,          // Default: 1
  permisoCartera: boolean,    // Default: false
  createdAt: Date,
  updatedAt: Date
}
```

---

### **Reserva (Reserva Hotelera)**

```typescript
{
  _id: ObjectId,
  hotel: string,
  agenciaId: ObjectId,        // Referencia a Agencia
  userId: ObjectId,           // Referencia a User
  cantidadHabitaciones: number,
  total: number,
  totalMitad: number,         // total / 2
  reservation: {
    source_of_bussiness: string,
    adults: string,
    checkin: Date,            // Formato: YYYY-MM-DD
    checkout: Date,
    children: string,
    children_ages: string,
    city: 'CARTAGENA' | 'BOGOTA' | 'SANTA MARTA',
    country: 'COL',
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
      checkin: Date,
      checkout: Date,
      currency: string,
      id: string,             // Room ID de Autocore
      quantity: string,
      rateId: string,         // Rate ID de Autocore
      unitaryPrice: number
    }]
  },
  reservaChatbotId: string,   // ID de reserva en Autocore
  titularInfo: {
    firstName: string,
    lastName: string,
    tipoDocumento: string,
    documento: string,
    fechaNacimiento: string
  },
  fechaLimitePago: Date,
  fechaLimitePago2: Date,
  exentoIva: boolean,
  reteFuente: {
    porcentaje: number,
    resultado: number
  },
  reteIva: {
    porcentaje: number,
    resultado: number
  },
  reteIca: {
    porcentaje: number,
    resultado: number
  },
  planAlimentario: string,
  adicionCena: boolean,
  adicionAlmuerzo: boolean,
  infoTransporte: {
    numeroVuelo: string,
    numeroVueloSalida?: string,
    aerolinea: string,
    tipoRecogida: number,
    firstContactNumber: string,
    secondContacNumber?: string,
    cantidadPersonas: number
  },
  infoToures: {
    nombres: string[],
    firstContactNumber: string,
    secondContacNumber?: string
  },
  mascotas: boolean,
  mascotasNumber: number,
  origenIata: string,
  createdAt: Date,
  updatedAt: Date
}
```

---

### **Cotizacion (Cotización)**

```typescript
{
  _id: ObjectId,
  userId: ObjectId,           // Referencia a User
  agenciaId: ObjectId,        // Referencia a Agencia
  hotel: string,
  cantidadHabitaciones: number,
  mascotasNumber: number,
  total: number,
  markup: number,
  porcentajemarkup: number,
  montoconmarkup: number,     // total + markup
  totalMitad: number,
  adicionCena: boolean,
  adicionAlmuerzo: boolean,
  planAlimentario: string,
  reteFuente: {
    porcentaje: number,
    resultado: number
  },
  reteIva: {
    porcentaje: number,
    resultado: number
  },
  reteIca: {
    porcentaje: number,
    resultado: number
  },
  exentoIva: boolean,
  status: 0 | 1 | 2 | 3,      // 0: Pendiente, 1: Aceptada, 2: Rechazada, 3: Convertida
  titularInfo: {
    firstName: string,
    lastName: string,
    tipoDocumento: string,
    documento: string,
    fechaNacimiento: string
  },
  reservation: {              // Mismo formato que Reserva.reservation
    // ... (ver Reserva)
  },
  fechaLimiteRespuesta: Date,
  notasSuperAdmin: string,
  landingUrl: string,         // URL de landing page pública
  landingHtml: string,        // HTML de landing page
  pdfUrl: string,             // URL de PDF en Cloudinary
  pdfCloudinaryId: string,    // Public ID en Cloudinary
  tokenAcceso: string,        // UUID para acceso público
  fechaAprobacion: Date,
  fechaRechazo: Date,
  motivoRechazo: string,
  reservaId: ObjectId,        // Referencia a Reserva (si fue convertida)
  infoTransporte: { /* ... */ },
  infoToures: { /* ... */ },
  asistentes: [],
  createdAt: Date,
  updatedAt: Date
}
```

---

### **Integration (Integración Externa)**

```typescript
{
  _id: ObjectId,
  name: string,
  apiKey: string,             // Generado automáticamente
  secretKey: string,          // Hasheado con bcrypt
  isActive: boolean,
  createdAt: Date,
  updatedAt: Date
}
```

---

### **OtpVerification (Verificación OTP)**

```typescript
{
  _id: ObjectId,
  otp: string,                // Código OTP (6 dígitos)
  expiresAt: Date,
  createdAt: Date
}
```

---

### **RefreshToken (Token de Actualización)**

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

### **Evento (Evento)**

```typescript
{
  _id: ObjectId,
  userId: ObjectId,           // Referencia a User
  title: string,
  description: string,
  startDate: Date,
  endDate: Date,
  location: string,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 🔐 Autenticación y Autorización

### **Roles del Sistema**

```typescript
enum ValidRoles {
  admin = 'admin',
  user = 'user',
  superAdmin = 'superAdmin'
}
```

### **Roles de Integraciones**

```typescript
enum ValidIntegrationsRoles {
  autocoreDev = 'autocore_dev',
  autocore = 'autocore'
}
```

### **Flujo de Autenticación JWT**

```
1. Cliente hace POST /auth/login
   Body: { email, password }
    ↓
2. AuthService valida credenciales (bcrypt)
    ↓
3. Si OTP está habilitado → generar y enviar OTP
    ↓
4. Cliente envía POST /auth/validate-otp
   Body: { email, otp }
    ↓
5. AuthService genera JWT + Refresh Token
    ↓
6. Response: {
     token: "eyJhbGc...",
     refreshToken: "uuid-v4...",
     user: { id, email, fullName, role }
   }
```

### **Guards Implementados**

#### **1. Auth Guard (JWT)**
```typescript
@UseGuards(AuthGuard)
// Requiere token JWT válido en header Authorization: Bearer {token}
```

#### **2. User Role Guard**
```typescript
@Auth(ValidRoles.admin)
// Requiere JWT + rol específico
```

#### **3. API Key Guard**
```typescript
@UseGuards(ApiKeyGuard)
// Requiere API Key en header x-api-key
```

### **Decoradores Personalizados**

```typescript
// Obtener usuario autenticado
@GetUser() user: User

// Verificar roles
@Auth(...roles: ValidRoles[])

// Obtener headers raw
@RawHeaders() rawHeaders: string[]
```

---

## 🔄 Flujos de Negocio Principales

### **1. Flujo de Creación de Reserva**

```
┌─────────────────────────────────────────────┐
│ 1. Consultar Disponibilidad                │
│    POST /reservas/disponibilidad            │
│    - Enviar layout (adultos, niños)         │
│    - Autocore retorna hoteles disponibles   │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 2. Cliente selecciona hotel y habitación   │
│    - Obtiene IDs de room y rate            │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 3. Crear Reserva                            │
│    POST /reservas                           │
│    - Validar datos del titular             │
│    - Crear reserva en Autocore             │
│    - Guardar en BD local                   │
│    - Actualizar usuario                    │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 4. Generar Link de Pago (Opcional)         │
│    POST /reservas/:id/link-pago             │
│    - Crear counterparty en Cobre           │
│    - Generar link de pago                  │
│    - Retornar URL de pago                  │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 5. Cliente realiza pago                    │
│    - Webhook de Cobre notifica pago        │
│    - Actualizar estado de reserva          │
└─────────────────────────────────────────────┘
```

---

### **2. Flujo de Cotización con Conversión Automática**

```
┌─────────────────────────────────────────────┐
│ 1. Agencia Crea Cotización                 │
│    POST /cotizaciones/from-disponibilidad   │
│    - Incluye landing HTML                  │
│    - Genera token de acceso único (UUID)   │
│    - Status: PENDIENTE (0)                 │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 2. Cliente Recibe Landing Page             │
│    GET /cotizaciones/public/:token          │
│    - Ve detalles de la cotización          │
│    - Botón: Aceptar / Rechazar             │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 3A. Cliente Acepta Cotización               │
│    POST /cotizaciones/public/responder/:token│
│    Body: { respuesta: 'ACEPTAR' }          │
│    - Status: ACEPTADA (1)                  │
│    - fechaAprobacion: Date.now()           │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 4. Conversión Automática a Reserva         │
│    convertirAReservaAutomatica()            │
│    ┌─────────────────────────────────────┐ │
│    │ 4.1. Buscar Hotel ID por nombre    │ │
│    │      - Búsqueda exacta o parcial   │ │
│    └─────────────────────────────────────┘ │
│    ┌─────────────────────────────────────┐ │
│    │ 4.2. Construir Layout               │ │
│    │      - Parsear adults, children_ages│ │
│    └─────────────────────────────────────┘ │
│    ┌─────────────────────────────────────┐ │
│    │ 4.3. Consultar Disponibilidad       │ │
│    │      - Autocore API                 │ │
│    │      - Try/Catch: Si falla (500),   │ │
│    │        continuar sin verificación   │ │
│    └─────────────────────────────────────┘ │
│    ┌─────────────────────────────────────┐ │
│    │ 4.4. Validar Disponibilidad         │ │
│    │      - Verificar habitaciones       │ │
│    │      - Verificar precios (±1%)      │ │
│    │      - Si no disponible: throw error│ │
│    └─────────────────────────────────────┘ │
│    ┌─────────────────────────────────────┐ │
│    │ 4.5. Crear Reserva en Autocore      │ │
│    │      - POST /v2/bookings/...        │ │
│    │      - Obtener chatbot_id           │ │
│    └─────────────────────────────────────┘ │
│    ┌─────────────────────────────────────┐ │
│    │ 4.6. Crear Reserva en BD Local      │ │
│    │      - reservaModel.create({...})   │ │
│    └─────────────────────────────────────┘ │
│    ┌─────────────────────────────────────┐ │
│    │ 4.7. Actualizar Usuario             │ │
│    │      - user.reservas.push(reserva)  │ │
│    └─────────────────────────────────────┘ │
│    ┌─────────────────────────────────────┐ │
│    │ 4.8. Actualizar Cotización          │ │
│    │      - status: CONVERTIDA_RESERVA(3)│ │
│    │      - reservaId: reserva._id       │ │
│    └─────────────────────────────────────┘ │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 5. Respuesta Exitosa                       │
│    {                                        │
│      message: "Reserva creada...",         │
│      reservaId: "...",                     │
│      reservaChatbotId: "...",              │
│      cotizacionId: "..."                   │
│    }                                        │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│ 3B. Cliente Rechaza Cotización             │
│    POST /cotizaciones/public/responder/:token│
│    Body: { respuesta: 'RECHAZAR', motivo } │
│    - Status: RECHAZADA (2)                 │
│    - fechaRechazo: Date.now()              │
│    - motivoRechazo: string                 │
└─────────────────────────────────────────────┘
```

---

### **3. Flujo de Generación de PDF**

```
┌─────────────────────────────────────────────┐
│ 1. Solicitar Generación de PDF             │
│    POST /cotizaciones/pdf                   │
│    Body: { cotizacionId }                  │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 2. Verificar si ya existe PDF              │
│    - Si cotizacion.pdfUrl existe →         │
│      retornar URL directamente             │
└────────────────┬────────────────────────────┘
                 │ No existe
┌────────────────▼────────────────────────────┐
│ 3. Inyectar CSS para Ocultar Botones       │
│    removerBotonesDelHTML(landingHtml)       │
│    - Agrega <style> con display: none      │
│    - Selectores: button[type="submit"],    │
│      .btn-aceptar, .btn-rechazar, etc.     │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 4. Generar PDF con Puppeteer               │
│    - Launch browser headless               │
│    - page.setContent(htmlModificado)       │
│    - page.pdf({ format: 'A4', ... })       │
│    - browser.close()                       │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 5. Subir PDF a Cloudinary                  │
│    uploadPdfToCloudinary(buffer, path)      │
│    - Retorna secure_url y public_id        │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 6. Actualizar Cotización                   │
│    - cotizacion.pdfUrl = secure_url        │
│    - cotizacion.pdfCloudinaryId = public_id│
│    - cotizacion.save()                     │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 7. Retornar URL del PDF                    │
│    return pdfUrl                            │
└─────────────────────────────────────────────┘
```

---

### **4. Flujo de Búsqueda de Vuelos (Amadeus)**

```
┌─────────────────────────────────────────────┐
│ 1. Cliente Busca Vuelos                    │
│    POST /vuelos/search                      │
│    Body: {                                  │
│      originLocationCode: 'BOG',            │
│      destinationLocationCode: 'CTG',       │
│      departureDate: '2025-12-10',          │
│      adults: 1,                             │
│      currencyCode: 'COP'                   │
│    }                                        │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 2. Autenticación con Amadeus               │
│    amadeusService.authenticate()            │
│    - POST /v1/security/oauth2/token        │
│    - Cachear token hasta expiración        │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 3. Buscar Ofertas de Vuelos                │
│    amadeusService.searchFlightOffers()      │
│    - GET /v2/shopping/flight-offers        │
│    - Parámetros: origen, destino, fecha    │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 4. Enriquecer Datos con Nombres            │
│    flightEnrichmentService.enrichFlightOffers()│
│    - Agregar nombres de ciudades           │
│    - Formatear duración                    │
│    - Calcular escalas                      │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 5. Retornar Ofertas Enriquecidas           │
│    return {                                 │
│      data: [...],                           │
│      meta: { count, ... },                 │
│      dictionaries: { ... }                 │
│    }                                        │
└─────────────────────────────────────────────┘
```

---

### **5. Flujo de Bot de Reservas Pendientes**

```
┌─────────────────────────────────────────────┐
│ 1. Cron Job se Ejecuta (Programado)        │
│    @Cron('0 9 * * *')  // Diario a las 9am │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 2. Buscar Reservas Pendientes de Pago      │
│    reservaModel.find({ status: 'pending' }) │
│    - Filtrar por fechas límite             │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 3. Generar Reporte Excel                   │
│    - ExcelJS: crear workbook               │
│    - Agregar columnas: Hotel, Cliente,     │
│      Check-in, Total, Días Restantes       │
│    - Estilizar con colores                 │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 4. Enviar Email con Adjunto                │
│    sendEmailService.sendEmail({            │
│      to: 'admin@agencia.com',              │
│      subject: 'Reservas Pendientes',       │
│      attachments: [excelBuffer]            │
│    })                                       │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│ 5. Log de Éxito                            │
│    logger.log('Reporte enviado: X reservas')│
└─────────────────────────────────────────────┘
```

---

## 🔧 Variables de Entorno

### **Archivo `.env` Requerido**

```env
# ============================================
# SERVER
# ============================================
PORT=3000

# ============================================
# DATABASE
# ============================================
MONGO_URL=mongodb://localhost:27017/agencias

# ============================================
# JWT AUTHENTICATION
# ============================================
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# ============================================
# COBRE (Pagos)
# ============================================
COBRE_API_URL=https://api.cobredigital.com
COBRE_USER_ID=your-cobre-user-id
COBRE_SECRET=your-cobre-secret
COBRE_AUTH_STRING=your-auth-string
COBRE_API_KEY=your-cobre-api-key

# ============================================
# CLOUDINARY (Archivos)
# ============================================
CLOUDINARY_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-cloudinary-api-key
CLOUDINARY_API_SECRET=your-cloudinary-api-secret

# ============================================
# EMAIL (SendGrid)
# ============================================
SENDGRID_API_KEY=SG.your-sendgrid-api-key
SENDER_EMAIL=noreply@youragency.com
EMAIL_APP_PASSWORD=your-email-app-password

# ============================================
# AUTOCORE (PMS Hotelero) - PRODUCCIÓN
# ============================================
AUTOCORE_URL=https://api.autocore.com
AUTOCORE_ACCESS_KEY=your-autocore-access-key
AUTOCORE_SECRET_KEY=your-autocore-secret-key

# ============================================
# AUTOCORE (PMS Hotelero) - DESARROLLO
# ============================================
AUTOCORE_URL_DEV=https://dev-api.autocore.com
AUTOCORE_ACCESS_KEY_DEV=your-dev-access-key
AUTOCORE_SECRET_KEY_DEV=your-dev-secret-key

# ============================================
# MY TOOL (Interno)
# ============================================
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

# ============================================
# AMADEUS (Vuelos)
# ============================================
AMADEUS_API_KEY=your-amadeus-api-key
AMADEUS_API_SECRET=your-amadeus-api-secret
AMADEUS_BASE_URL=https://api.amadeus.com
```

---

## 🔌 API Endpoints

### **Base URL**
```
http://localhost:3000/agencias/v1
```

### **Autenticación**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/auth/register` | Registrar usuario | ❌ |
| POST | `/auth/login` | Iniciar sesión | ❌ |
| POST | `/auth/validate-otp` | Validar código OTP | ❌ |
| POST | `/auth/refresh-token` | Renovar token JWT | ❌ |
| GET | `/auth/check-status` | Verificar sesión activa | ✅ JWT |
| POST | `/auth/request-password-change` | Solicitar cambio de contraseña | ❌ |
| POST | `/auth/new-password` | Establecer nueva contraseña | ❌ |

---

### **Reservas**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/reservas/disponibilidad` | Consultar disponibilidad | ✅ JWT |
| POST | `/reservas` | Crear reserva | ✅ JWT |
| GET | `/reservas` | Listar reservas del usuario | ✅ JWT |
| GET | `/reservas/:id` | Obtener reserva por ID | ✅ JWT |
| PATCH | `/reservas/:id` | Actualizar reserva | ✅ JWT |
| DELETE | `/reservas/:id` | Cancelar reserva | ✅ JWT |
| POST | `/reservas/:id/link-pago` | Generar link de pago | ✅ JWT |
| POST | `/reservas/:id/pago-billetera` | Pagar con billetera | ✅ JWT |

---

### **Cotizaciones (Privadas)**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/cotizaciones` | Crear cotización manual | ✅ JWT |
| POST | `/cotizaciones/from-disponibilidad` | Crear desde disponibilidad | ✅ JWT |
| GET | `/cotizaciones` | Listar cotizaciones | ✅ JWT |
| GET | `/cotizaciones/:id` | Obtener cotización por ID | ✅ JWT |
| PATCH | `/cotizaciones/:id` | Actualizar cotización | ✅ JWT |
| DELETE | `/cotizaciones/:id` | Eliminar cotización | ✅ JWT |
| POST | `/cotizaciones/pdf` | Generar PDF | ✅ JWT |
| POST | `/cotizaciones/convertir-reserva/:id` | Convertir a reserva (manual) | ✅ JWT |

---

### **Cotizaciones (Públicas)**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| GET | `/cotizaciones-public/:token` | Ver cotización por token | ❌ |
| POST | `/cotizaciones-public/responder/:token` | Aceptar/Rechazar cotización | ❌ |

---

### **Vuelos**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/vuelos/search` | Buscar vuelos | ✅ JWT |
| GET | `/vuelos/locations` | Buscar aeropuertos/ciudades | ✅ JWT |
| GET | `/vuelos/airports/:iata` | Buscar aeropuerto por IATA | ✅ JWT |
| POST | `/vuelos/order` | Crear orden de vuelo | ✅ JWT |
| GET | `/vuelos/test-auth` | Probar autenticación Amadeus | ✅ JWT |

---

### **Agencias**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/agencias` | Crear agencia | ✅ JWT (Admin) |
| GET | `/agencias` | Listar agencias | ✅ JWT (Admin) |
| GET | `/agencias/:id` | Obtener agencia por ID | ✅ JWT |
| PATCH | `/agencias/:id` | Actualizar agencia | ✅ JWT (Admin) |
| DELETE | `/agencias/:id` | Desactivar agencia | ✅ JWT (SuperAdmin) |
| POST | `/agencias/:id/recargar-billetera` | Recargar billetera | ✅ JWT |
| GET | `/agencias/:id/saldo` | Obtener saldo | ✅ JWT |

---

### **Integraciones (API Key)**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/integrations` | Crear integración | ✅ JWT (SuperAdmin) |
| POST | `/integrations/disponibilidad` | Consultar disponibilidad | ✅ API Key |

---

### **Cloudinary**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/cloudinary/upload` | Subir imagen | ✅ JWT |
| DELETE | `/cloudinary/:publicId` | Eliminar recurso | ✅ JWT |

---

### **Notificaciones**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/notificaciones/send` | Enviar notificación manual | ✅ JWT (Admin) |
| GET | `/notificaciones/usuario/:userId` | Listar notificaciones | ✅ JWT |

---

### **Eventos**

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/eventos` | Crear evento | ✅ JWT |
| GET | `/eventos` | Listar eventos | ✅ JWT |
| GET | `/eventos/:id` | Obtener evento | ✅ JWT |
| PATCH | `/eventos/:id` | Actualizar evento | ✅ JWT |
| DELETE | `/eventos/:id` | Eliminar evento | ✅ JWT |

---

## 🚀 Instalación y Configuración

### **Requisitos Previos**
- Node.js v20+
- MongoDB v6+
- npm v9+

### **Instalación**

```bash
# 1. Clonar repositorio
git clone https://github.com/tu-organizacion/agencias-api.git
cd agencias-api

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 4. Iniciar MongoDB (si es local)
mongod --dbpath /path/to/data

# 5. Compilar proyecto
npm run build

# 6. Iniciar servidor
npm run start:dev  # Desarrollo con hot-reload
npm run start:prod # Producción
```

### **Verificación de Instalación**

```bash
# Verificar que el servidor está corriendo
curl http://localhost:3000/agencias/v1/auth/check-status
```

---

## 📊 Manejo de Errores

### **Errores Comunes**

#### **1. Error 500 de Autocore durante disponibilidad**
**Problema:** El API de Autocore retorna error 500.

**Solución Implementada:**
```typescript
try {
  disponibilidadResponse = await httpCustomService.getDisponibilidadAutocore(...);
  disponibilidadVerificada = true;
} catch (error) {
  logger.warn('⚠️ Autocore no disponible. Continuando sin verificación...');
  disponibilidadResponse = null;
  disponibilidadVerificada = false;
}
```

**Resultado:** El sistema continúa creando la reserva sin verificación de disponibilidad cuando Autocore falla.

---

#### **2. Hotel no encontrado en configuración**
**Problema:** El nombre del hotel en la cotización no coincide exactamente con `autocoreConstants.ts`.

**Solución Implementada:**
```typescript
private encontrarHotelIdPorNombre(nombreHotel: string): string | null {
  // Búsqueda exacta
  let hotelEncontrado = hoteles.find(
    ([_, data]) => data.name.toLowerCase() === nombreHotel.toLowerCase()
  );
  
  // Si no encuentra, búsqueda parcial
  if (!hotelEncontrado) {
    hotelEncontrado = hoteles.find(([_, data]) => {
      const hotelNameLower = data.name.toLowerCase();
      const searchNameLower = nombreHotel.toLowerCase();
      return (
        hotelNameLower.includes(searchNameLower) ||
        searchNameLower.includes(hotelNameLower)
      );
    });
  }
  
  return hotelEncontrado ? hotelEncontrado[0] : null;
}
```

**Resultado:** Búsqueda flexible que permite coincidencias parciales.

---

#### **3. Variación de precio en conversión de cotización**
**Problema:** El precio cambió entre la generación de la cotización y la aceptación.

**Solución Implementada:**
```typescript
const precioOriginal = room.unitaryPrice;
const precioActual = habitacionEncontrada.rates[0].price;
const diferencia = Math.abs(precioActual - precioOriginal);
const porcentajeDiferencia = (diferencia / precioOriginal) * 100;

if (porcentajeDiferencia >= 1) {
  variacionesPrecio.push({
    habitacion: room.nombreHabitacion,
    precioOriginal,
    precioActual,
    diferencia: precioActual - precioOriginal,
    porcentaje: porcentajeDiferencia.toFixed(2),
  });
}
```

**Resultado:** Se bloquea la conversión y se notifica al cliente si hay una variación ≥ 1%.

---

## 🔒 Seguridad

### **Medidas Implementadas**

1. **Hashing de Contraseñas:** bcrypt con 10 rounds
2. **JWT:** Tokens firmados con secret key
3. **Refresh Tokens:** UUID v4 con expiración
4. **Validación de DTOs:** class-validator + class-transformer
5. **Guards de Roles:** Protección de endpoints por rol
6. **API Keys Hasheadas:** bcrypt para integrations
7. **CORS Configurado:** Solo orígenes permitidos
8. **Sanitización de Inputs:** whitelist + forbidNonWhitelisted
9. **Rate Limiting:** (Recomendado implementar)
10. **HTTPS:** (Recomendado en producción)

---

## 📈 Escalabilidad y Rendimiento

### **Optimizaciones Implementadas**

1. **Conexión Persistente a MongoDB:** Mongoose pooling
2. **Cacheo de Tokens OAuth:** Amadeus token cacheado
3. **Índices en MongoDB:**
   - `User.email` (unique)
   - `Agencia.slug` (unique)
   - `Agencia.documentInfo.document` (unique)
4. **Lazy Loading de Módulos:** Imports dinámicos
5. **Puppeteer Headless:** Generación de PDF sin GUI

### **Recomendaciones para Producción**

1. **Load Balancer:** Nginx o AWS ELB
2. **Clusters de Node.js:** PM2 para multi-core
3. **CDN para Cloudinary:** Servir assets desde CDN
4. **Redis para Sesiones:** Cacheo de sesiones JWT
5. **MongoDB Atlas:** Cluster replicado
6. **Monitoring:** Sentry, Datadog, New Relic
7. **CI/CD:** GitHub Actions, GitLab CI
8. **Contenedores:** Docker + Docker Compose

---

## 📝 Scripts NPM

```bash
# Desarrollo
npm run start:dev       # Inicia con hot-reload

# Producción
npm run build           # Compila TypeScript
npm run start:prod      # Inicia versión compilada

# Testing
npm run test            # Unit tests
npm run test:e2e        # E2E tests
npm run test:cov        # Coverage report

# Linting y Formateo
npm run lint            # ESLint
npm run format          # Prettier
```

---

## 🐛 Debugging

### **Logs del Sistema**

El sistema utiliza el Logger de NestJS:

```typescript
private readonly logger = new Logger(ServiceName.name);

this.logger.log('✅ Operación exitosa');
this.logger.warn('⚠️ Advertencia');
this.logger.error('❌ Error crítico', error);
```

### **Niveles de Log Configurados**

```typescript
logger: ['log', 'error', 'warn']  // En main.ts
```

### **Debugging con VS Code**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug NestJS",
      "runtimeArgs": ["--nolazy", "-r", "ts-node/register"],
      "args": ["${workspaceFolder}/src/main.ts"],
      "env": {
        "NODE_ENV": "development"
      },
      "sourceMaps": true,
      "cwd": "${workspaceFolder}",
      "protocol": "inspector"
    }
  ]
}
```

---

## 📚 Recursos Adicionales

### **Documentación de Dependencias**

- [NestJS](https://docs.nestjs.com)
- [Mongoose](https://mongoosejs.com/docs/)
- [Puppeteer](https://pptr.dev/)
- [Amadeus API](https://developers.amadeus.com/)
- [SendGrid](https://docs.sendgrid.com/)
- [Cloudinary](https://cloudinary.com/documentation)

### **Scripts Útiles**

```bash
# PowerShell Scripts (Windows)
.\ejecutar-bot.ps1         # Ejecutar bot de reportes
.\validar-token.ps1        # Validar token JWT
```

---

## 📞 Contacto y Soporte

Para preguntas técnicas o soporte, contactar a:
- **Email:** innovacion@gehsuites.com
- **Repositorio:** (URL del repositorio)

---

## 📅 Changelog

### **v0.0.1** (Fecha actual)
- ✅ Sistema de autenticación JWT completo
- ✅ Módulo de reservas con Autocore
- ✅ Módulo de cotizaciones con conversión automática
- ✅ Generación de PDFs con Puppeteer
- ✅ Integración con Amadeus para vuelos
- ✅ Sistema de pagos con Cobre
- ✅ Bot automatizado de reportes
- ✅ Gestión multi-agencia
- ✅ Upload de archivos a Cloudinary
- ✅ Sistema de notificaciones por email

---

## 📄 Licencia

**UNLICENSED** - Código propietario

---

**Última actualización:** Octubre 28, 2025
**Versión del documento:** 1.0.0

