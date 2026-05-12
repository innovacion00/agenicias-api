# Ejemplos anonimizados de modelos de base de datos

Estos ejemplos estan anonimizados y usan datos ficticios. Mantienen la estructura esperada por los esquemas de Mongoose del proyecto.

## `Agencia`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9001",
  "emailContacto": "contacto+agencia_demo@example.com",
  "telefonoContacto": "+573001112233",
  "fullName": "agencia ejemplo sas",
  "slug": "agencia-ejemplo-sas",
  "saldo": 1250000,
  "category": 1,
  "documentInfo": {
    "tipo": "NIT",
    "document": "900999888-1"
  },
  "cobreInfo": {
    "bolcilloId": "BOL-ANON-001",
    "counterPartyId": "CP-ANON-001"
  },
  "autocoreInfo": {
    "id": 1042
  },
  "empresa": true,
  "isActive": true,
  "usuarios": [
    "68218f7e3b9f2a1f4d7c9101"
  ],
  "userLimit": 15,
  "permisoCartera": true,
  "politicasAgencia": "Politicas internas anonimizadas.",
  "maarlabApiKey": "ml_live_ANON_KEY_XXXX"
}
```

## `User`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9101",
  "email": "usuario.demo@example.com",
  "password": "$2b$10$HASH_ANONIMIZADO",
  "telefono": "+573005556677",
  "fullName": "usuario demo",
  "isActive": true,
  "settings": {
    "omitirOtp": false
  },
  "firstLog": false,
  "role": [
    "admin"
  ],
  "imageUrl": "https://cdn.example.com/avatars/user-demo.png",
  "agencia": "68218f7e3b9f2a1f4d7c9001",
  "otpRef": "68218f7e3b9f2a1f4d7c9201",
  "reservas": [
    "68218f7e3b9f2a1f4d7c9301"
  ],
  "eventos": [
    "68218f7e3b9f2a1f4d7c9401"
  ],
  "politicasAgencia": "Resumen de politicas visible para usuario."
}
```

## `OtpVerification`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9201",
  "userId": "68218f7e3b9f2a1f4d7c9101",
  "otp": "839201",
  "usado": false,
  "expiresAt": "2026-05-12T14:30:00.000Z"
}
```

## `RefreshToken`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9202",
  "userId": "68218f7e3b9f2a1f4d7c9101",
  "token": "rt_ANONIMIZADO_eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
  "expiresAt": "2026-06-12T14:00:00.000Z",
  "isActive": true,
  "createdAt": "2026-05-12T14:00:00.000Z",
  "updatedAt": "2026-05-12T14:00:00.000Z"
}
```

## `Cotizacion`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9302",
  "userId": "68218f7e3b9f2a1f4d7c9101",
  "agenciaId": "68218f7e3b9f2a1f4d7c9001",
  "hotel": "hotel costa demo",
  "cantidadHabitaciones": 2,
  "origenIata": "BOG",
  "mascotas": false,
  "mascotasNumber": 0,
  "total": 2450000,
  "markup": 245000,
  "porcentajemarkup": 10,
  "totalMitad": 1225000,
  "adicionCena": true,
  "adicionAlmuerzo": false,
  "planAlimentario": "desayuno y cena",
  "infoTransporte": {
    "numeroVuelo": "AV123",
    "numeroVueloSalida": "AV124",
    "aerolinea": "Avianca",
    "tipoRecogida": 1,
    "firstContactNumber": "+573001234567",
    "secondContacNumber": "+573001234568",
    "cantidadPersonas": 3
  },
  "infoToures": {
    "nombres": [
      "Tour ciudad",
      "Tour playa"
    ],
    "firstContactNumber": "+573001234567",
    "secondContacNumber": "+573001234568"
  },
  "reteFuente": {
    "porcentaje": 1.5,
    "resultado": 36750
  },
  "reteIva": {
    "porcentaje": 15,
    "resultado": 367500
  },
  "reteIca": {
    "porcentaje": 0.5,
    "resultado": 12250
  },
  "exentoIva": false,
  "status": 0,
  "asistentes": [
    {
      "fullName": "Asistente Uno",
      "tipoDocumento": "CC",
      "documento": "1000123456",
      "telefono": "+573001111111",
      "email": "asistente1@example.com"
    }
  ],
  "titularInfo": {
    "firstName": "Titular",
    "lastName": "Demo",
    "tipoDocumento": "CC",
    "documento": "1000111222",
    "fechaNacimiento": "1990-01-15"
  },
  "reservation": {
    "source_of_bussiness": "web",
    "adults": "2",
    "checkin": "2026-08-01",
    "checkout": "2026-08-05",
    "children": "1",
    "children_ages": "6",
    "city": "cartagena",
    "country": "co",
    "currency": "COP",
    "email": "titular.demo@example.com",
    "telephone": "+573001234567",
    "firstName": "Titular",
    "lastName": "Demo",
    "nights": "4",
    "notes": "Solicitud anonima de prueba",
    "rooms": "1",
    "roomsData": [
      {
        "nombreHabitacion": "doble estandar",
        "adults": "2",
        "children": "1",
        "children_ages": "6",
        "checkin": "2026-08-01",
        "checkout": "2026-08-05",
        "currency": "COP",
        "id": "ROOM-ANON-01",
        "quantity": "1",
        "rateId": "RATE-ANON-01",
        "unitaryPrice": 612500
      }
    ]
  },
  "cotizacionChatbotId": "CHATBOT-COT-ANON-001",
  "fechaLimiteRespuesta": "2026-05-13T23:59:59.000Z",
  "notasSuperAdmin": "Observacion anonima para seguimiento.",
  "landingUrl": "https://landing.example.com/cotizacion/ANON-001",
  "landingHtml": "<html><!-- anon --></html>",
  "pdfUrl": "https://cdn.example.com/pdfs/cotizacion-anon-001.pdf",
  "pdfCloudinaryId": "cotizaciones/anon_001",
  "tokenAcceso": "tok_access_ANON_001",
  "fechaAprobacion": null,
  "fechaRechazo": null,
  "motivoRechazo": "",
  "reservaId": null
}
```

## `Reserva`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9301",
  "userId": "68218f7e3b9f2a1f4d7c9101",
  "agenciaId": "68218f7e3b9f2a1f4d7c9001",
  "hotel": "hotel costa demo",
  "cantidadHabitaciones": 2,
  "origenIata": "BOG",
  "mascotas": false,
  "mascotasNumber": 0,
  "total": 2450000,
  "totalMitad": 1225000,
  "adicionCena": true,
  "adicionAlmuerzo": false,
  "pagadoPrimeraMitad": true,
  "planAlimentario": "desayuno y cena",
  "infoTransporte": {
    "numeroVuelo": "AV123",
    "numeroVueloSalida": "AV124",
    "aerolinea": "Avianca",
    "tipoRecogida": 1,
    "firstContactNumber": "+573001234567",
    "secondContacNumber": "+573001234568",
    "cantidadPersonas": 3
  },
  "infoToures": {
    "nombres": [
      "Tour ciudad"
    ],
    "firstContactNumber": "+573001234567",
    "secondContacNumber": "+573001234568"
  },
  "reteFuente": {
    "porcentaje": 1.5,
    "resultado": 36750
  },
  "reteIva": {
    "porcentaje": 15,
    "resultado": 367500
  },
  "reteIca": {
    "porcentaje": 0.5,
    "resultado": 12250
  },
  "exentoIva": false,
  "status": 3,
  "cancelInProgress": false,
  "cancelRequestedAt": null,
  "cancelProcessedAt": null,
  "cancelOpId": "",
  "asistentes": [
    {
      "fullName": "Asistente Uno",
      "tipoDocumento": "CC",
      "documento": "1000123456",
      "telefono": "+573001111111",
      "email": "asistente1@example.com"
    }
  ],
  "titularInfo": {
    "firstName": "Titular",
    "lastName": "Demo",
    "tipoDocumento": "CC",
    "documento": "1000111222",
    "fechaNacimiento": "1990-01-15"
  },
  "reservation": {
    "source_of_bussiness": "web",
    "adults": "2",
    "checkin": "2026-08-01",
    "checkout": "2026-08-05",
    "children": "1",
    "children_ages": "6",
    "city": "cartagena",
    "country": "co",
    "currency": "COP",
    "email": "titular.demo@example.com",
    "telephone": "+573001234567",
    "firstName": "Titular",
    "lastName": "Demo",
    "nights": "4",
    "notes": "Reserva anonima de ejemplo",
    "rooms": "1",
    "roomsData": [
      {
        "nombreHabitacion": "doble estandar",
        "adults": "2",
        "children": "1",
        "children_ages": "6",
        "checkin": "2026-08-01",
        "checkout": "2026-08-05",
        "currency": "COP",
        "id": "ROOM-ANON-01",
        "quantity": "1",
        "rateId": "RATE-ANON-01",
        "unitaryPrice": 612500,
        "room_id": "MYTOOL-ROOM-001"
      }
    ]
  },
  "reservaChatbotId": "CHATBOT-RES-ANON-001",
  "paymenIds": [
    "PAY-ANON-001"
  ],
  "fechaLimitePago": "2026-05-13T23:59:59.000Z",
  "fechaLimitePago2": "2026-05-20T23:59:59.000Z",
  "notasSuperAdmin": "Seguimiento interno anonimo",
  "notasagencias": "Pendiente confirmacion de itinerario",
  "linkInfo": {
    "link": "https://pay.example.com/checkout/ANON-001",
    "expirationDate": "2026-05-13T23:59:59.000Z",
    "idLinkPago": "LINK-ANON-001"
  },
  "linksHistory": [
    {
      "id": "LINK-ANON-001",
      "typeOfPayment": "pse",
      "state": 1,
      "fecha": "2026-05-12T14:10:00.000Z"
    }
  ],
  "reservaProvider": "autocore",
  "myToolCanalVentaId": null,
  "vuelo": [
    {
      "packageId": "PKG-ANON-001",
      "respuestaMaarLab": {
        "bookingId": "BOOK-ANON-001",
        "status": "confirmed"
      },
      "createdAt": "2026-05-12T14:12:00.000Z"
    }
  ]
}
```

## `BookingPersona`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9303",
  "hotel": "hotel persona demo",
  "cantidadHabitaciones": 1,
  "origenIata": "MDE",
  "mascotas": false,
  "mascotasNumber": 0,
  "total": 980000,
  "adicionCena": false,
  "adicionAlmuerzo": true,
  "pagadoPrimeraMitad": false,
  "planAlimentario": "desayuno y almuerzo",
  "exentoIva": false,
  "status": 0,
  "titularInfo": {
    "firstName": "Persona",
    "lastName": "Demo",
    "tipoDocumento": "CC",
    "documento": "1099000111",
    "fechaNacimiento": "1994-10-21"
  },
  "reservation": {
    "source_of_bussiness": "landing",
    "adults": "1",
    "checkin": "2026-09-10",
    "checkout": "2026-09-12",
    "children": "",
    "children_ages": "",
    "city": "medellin",
    "country": "co",
    "currency": "COP",
    "email": "persona.demo@example.com",
    "telephone": "+573009998877",
    "firstName": "Persona",
    "lastName": "Demo",
    "nights": "2",
    "notes": "Viaje individual anonimo",
    "rooms": "1",
    "roomsData": [
      {
        "nombreHabitacion": "individual",
        "adults": "1",
        "children": "",
        "children_ages": "",
        "checkin": "2026-09-10",
        "checkout": "2026-09-12",
        "currency": "COP",
        "id": "ROOM-PER-001",
        "quantity": "1",
        "rateId": "RATE-PER-001",
        "unitaryPrice": 490000
      }
    ]
  },
  "reservaChatbotId": "CHATBOT-PER-ANON-001",
  "paymenIds": [],
  "fechaLimitePago": "2026-05-15T23:59:59.000Z",
  "fechaLimitePago2": "",
  "linkInfo": {
    "link": "",
    "expirationDate": "",
    "idLinkPago": ""
  },
  "linksHistory": []
}
```

## `PaymentPending`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9304",
  "payment_code": "PAYCODE-ANON-001",
  "external_ref_id": "EXT-REF-ANON-001",
  "status": "pending",
  "amount": 980000,
  "currency": "COP",
  "transaction_id": "",
  "paid_at": null,
  "hotel_id": "HOTEL-ANON-001",
  "reservation_data": {
    "hotel": "hotel persona demo",
    "city": "medellin"
  },
  "reserva_id": "",
  "reserva_creada": false
}
```

## `Evento`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9401",
  "userId": "68218f7e3b9f2a1f4d7c9101",
  "agenciaId": "68218f7e3b9f2a1f4d7c9001",
  "nameEvento": "convencion comercial demo",
  "tipoEvento": 1,
  "nombreOrganizador": "organizador demo",
  "telefonoOrganizador": "+573004445566",
  "emailOrganizador": "organizador.demo@example.com",
  "cantidadAsistentes": 120,
  "fechaInicioEvento": "2026-11-03T08:00:00.000Z",
  "fechaFinalEvento": "2026-11-05T18:00:00.000Z",
  "horarioEvento": [
    {
      "fechaInicio": "2026-11-03T08:00:00.000Z",
      "fechaFinal": "2026-11-03T18:00:00.000Z",
      "cantidadAsistenteDia": 120
    }
  ],
  "flexibilidadEvento": true,
  "tipoAcomodacion": 1,
  "alimentacion": true,
  "alimentosBebidas": {
    "estacionCafe": true,
    "coffeBreak": true,
    "desayuno": true,
    "almuerzo": true,
    "cena": false
  },
  "audiovisuales": true,
  "itemsAudiovisuales": [
    "proyector",
    "microfonos"
  ],
  "decoracion": false,
  "decoracionDescripcion": "",
  "alojamiento": true,
  "observaciones": "Evento de ejemplo con datos anonimizados."
}
```

## `Integration`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9501",
  "name": "pasarela-demo",
  "apiKey": "int_api_ANON_123456",
  "secretKey": "int_secret_ANON_abcdef",
  "isActive": true,
  "roles": [
    "reservas:write",
    "cotizaciones:read"
  ]
}
```

## `MaarlabPartnerCredential`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9601",
  "idSearchEngine": "SE-ANON-001",
  "hotelName": "agencia ejemplo sas",
  "apiKey": "ml_partner_ANON_001",
  "agenciaId": "68218f7e3b9f2a1f4d7c9001",
  "lastSyncedAt": "2026-05-12T13:55:00.000Z"
}
```

## `AeropuertoReferencia`

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9701",
  "icao": "SKBO",
  "iata": "BOG",
  "name": "El Dorado International Airport",
  "city": "Bogota",
  "state": "Cundinamarca",
  "country": "Colombia",
  "elevation": 8361,
  "lat": 4.70159,
  "lon": -74.1469,
  "tz": "America/Bogota",
  "normName": "el dorado international airport",
  "normCity": "bogota"
}
```
