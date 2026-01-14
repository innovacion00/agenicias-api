# 📋 Endpoints de Booking Personas - Guía de Integración Frontend
## 🔐 Autenticación
Todos los endpoints (excepto el webhook) requieren autenticación con token estático:
**Header requerido:**
```
Authorization: Bearer <BOOKING_PERSONAS_TOKEN>
```
O alternativamente:
```
x-booking-token: <BOOKING_PERSONAS_TOKEN>
```
El token se obtiene de la variable de entorno `BOOKING_PERSONAS_TOKEN`.
---
## 📍 Base URL
```
https://gehsuitesapps.com/agencias/v1/booking-personas
```
---
## 📝 Lista de Endpoints
### 1. **POST /disponibilidad**
Consultar disponibilidad de hoteles en una ciudad.
**Autenticación:** ✅ Requerida (Static Token)
**Request:**
```http
POST /agencias/v1/booking-personas/disponibilidad
Authorization: Bearer <TOKEN>
Content-Type: application/json
{
  "city": "Cartagena",
  "checkin": "2025-02-22",
  "nights": 2,
  "adults": 2,
  "children_ages": "10,14",  // Opcional
  "room_type": "DOUBLE"      // Opcional
}
```
**Response (200):**
```json
[
  {
    "hotel": {
      "id": 9,
      "name": "Hotel Marina Suites",
      "roomcloud_id": "13643",
      "city": "CARTAGENA",
      "largest_room_beds": 4
    },
    "availability": [
      {
        "adults": 2,
        "children_ages": null,
        "total_count": 41,
        "available_rooms": [
          {
            "roomId": "83528",
            "roomName": "Habitacion Doble Standard",
            "beds": 2,
            "adults": 2,
            "children_ages": null,
            "count": 32,
            "products": [
              {
                "roomId": "83528",
                "roomName": "Habitacion Doble Standard[Booking connect Neto]",
                "roomType": "DOUBLE",
                "rateId": "99093",
                "rateDescription": "Standard Double[Booking connect Neto]",
                "boardType": null,
                "boardTypeDescription": "NO ESPECIFICADO",
                "refundable": "full",
                "cancellationPolicy": "The guest can cancel free of charge until the day of arrival.",
                "currency": "COP",
                "trm": 3370.03,
                "baseDailyAmounts": [...],
                "baseRate": {
                  "amountBeforeTax": 279300,
                  "amountAfterTax": 332367,
                  "amountBeforeTaxUSD": 82.88,
                  "amountAfterTaxUSD": 98.62
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
---
### 2. **POST /generar-link-pago**
Generar link de pago para la reserva.
**Autenticación:** ✅ Requerida (Static Token)
**Request:**
```http
POST /agencias/v1/booking-personas/generar-link-pago?hotelId=13645
Authorization: Bearer <TOKEN>
Content-Type: application/json
{
  "hotel_id": "13645",
  "amount": 580000,
  "currency": "COP",
  "guest_name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "+573001234567",
  "booking_dates": "2025-02-22 - 2025-02-24",
  "description": "Pago para reserva de 2 noches en Hotel Azuan",
  "reservation_data": {
    "total": 580000,
    "titularInfo": {
      "firstName": "Juan",
      "lastName": "Pérez",
      "tipoDocumento": "CC",
      "documento": "1234567890",
      "fechaNacimiento": "1990-01-15"
    },
    "reservation": {
      "adults": "2",
      "checkin": "2025-02-22",
      "checkout": "2025-02-24",
      "children": "2",
      "children_ages": "10,14",
      "city": "CARTAGENA",
      "country": "COL",
      "currency": "COP",
      "email": "juan@example.com",
      "telephone": "+573001234567",
      "firstName": "Juan",
      "lastName": "Pérez",
      "nights": "2",
      "notes": "",
      "rooms": "1",
      "roomsData": [{
        "nombreHabitacion": "Habitacion Cuadruple Standard",
        "adults": "2",
        "children": "2",
        "children_ages": "10,14",
        "checkin": "2025-02-22",
        "checkout": "2025-02-24",
        "currency": "COP",
        "id": "83529",
        "quantity": "1",
        "rateId": "51490",
        "unitaryPrice": 580000
      }]
    },
    "planAlimentario": "Solo desayuno",
    "adicionCena": false,
    "adicionAlmuerzo": false,
    "exentoIva": false,
    "mascotas": false,
    "mascotasNumber": 0,
    "origenIata": "BOG"
  }
}
```
**Response (200):**
```json
{
  "payment_url": "https://autocore.com/payment/ABC123XYZ",
  "payment_code": "PAY-20250222-001",
  "message": "Link de pago generado exitosamente. La reserva se creará automáticamente después de que el pago sea completado."
}
```
**Nota:** El campo `reservation_data` es **opcional**. Si se incluye, la reserva se creará automáticamente después del pago. Si no se incluye, deberás crear la reserva manualmente usando el endpoint `/reservar`.
---
### 3. **POST /reservar**
Crear una reserva (requiere pago previo completado).
**Autenticación:** ✅ Requerida (Static Token)
**Request:**
```http
POST /agencias/v1/booking-personas/reservar?hotelId=13645&paymentCode=PAY-20250222-001
Authorization: Bearer <TOKEN>
Content-Type: application/json
{
  "total": 580000,
  "titularInfo": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "tipoDocumento": "CC",
    "documento": "1234567890",
    "fechaNacimiento": "1990-01-15"
  },
  "reservation": {
    "adults": "2",
    "checkin": "2025-02-22",
    "checkout": "2025-02-24",
    "children": "2",
    "children_ages": "10,14",
    "city": "CARTAGENA",
    "country": "COL",
    "currency": "COP",
    "email": "juan@example.com",
    "telephone": "+573001234567",
    "firstName": "Juan",
    "lastName": "Pérez",
    "nights": "2",
    "notes": "",
    "rooms": "1",
    "roomsData": [{
      "nombreHabitacion": "Habitacion Cuadruple Standard",
      "adults": "2",
      "children": "2",
      "children_ages": "10,14",
      "checkin": "2025-02-22",
      "checkout": "2025-02-24",
      "currency": "COP",
      "id": "83529",
      "quantity": "1",
      "rateId": "51490",
      "unitaryPrice": 580000
    }]
  },
  "planAlimentario": "Solo desayuno",
  "adicionCena": false,
  "adicionAlmuerzo": false,
  "exentoIva": false,
  "mascotas": false,
  "mascotasNumber": 0,
  "origenIata": "BOG"
}
```
**Response (201) - Si la reserva ya fue creada automáticamente:**
```json
{
  "reservaId": "65f1a2b3c4d5e6f7g8h9i0j2",
  "chatbotId": "BK-00230690",
  "message": "La reserva ya fue creada automáticamente después del pago.",
  "yaExiste": true
}
```
**Response (201) - Si se crea manualmente:**
```json
{
  "reservaId": "65f1a2b3c4d5e6f7g8h9i0j2",
  "chatbotId": "BK-00230690",
  "message": "Reserva creada exitosamente con pago completo"
}
```
---
### 4. **POST /change-status**
Webhook para recibir notificaciones de cambio de estado de pago (solo Autocore).
**Autenticación:** ❌ No requerida (público)
**Request (desde Autocore):**
```http
POST /agencias/v1/booking-personas/change-status
Content-Type: application/json
{
  "external_ref_id": "personas_1737654321000_k2j3h4g5f",
  "transaction_id": "TXN-ABC123XYZ789",
  "payment_status": "aplicado",
  "details": {
    "id": "PAY-20250222-001",
    "pay_platform": "stripe"
  }
}
```
**Response (200):**
```json
{
  "success": true,
  "status": "paid"
}
```
**Nota:** Este endpoint es llamado automáticamente por Autocore cuando cambia el estado del pago. El frontend **NO debe llamar este endpoint directamente**.
---
## 🔄 Flujo de Integración Frontend
### **Flujo Completo Recomendado:**

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUARIO BUSCA DISPONIBILIDAD                             │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /disponibilidad                                         │
│ Body: { city, checkin, nights, adults, children_ages }        │
│                                                               │
│ Respuesta: Lista de hoteles con habitaciones disponibles    │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. USUARIO SELECCIONA HABITACIÓN Y COMPLETA DATOS           │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ POST /generar-link-pago?hotelId={id}                         │
│ Body: {                                                       │
│   hotel_id, amount, currency, guest_name, email, phone,      │
│   booking_dates, description,                                │
│   reservation_data: { ...datos completos de la reserva }    │
│ }                                                             │
│                                                               │
│ Respuesta: { payment_url, payment_code, message }            │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. REDIRIGIR AL USUARIO A payment_url                        │
│    (El usuario completa el pago en Autocore)                 │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. AUTOCORE PROCESA EL PAGO                                  │
│    (Autocore llama automáticamente al webhook)               │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. WEBHOOK: POST /change-status                              │
│    (Autocore → Backend)                                      │
│    Si payment_status = "aplicado" Y hay reservation_data:    │
│    → La reserva se crea AUTOMÁTICAMENTE                      │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. USUARIO ES REDIRIGIDO A success_url o failure_url         │
│    (Configurado en generar-link-pago)                        │
└─────────────────────────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. (OPCIONAL) VERIFICAR/CREAR RESERVA                        │
│ POST /reservar?hotelId={id}&paymentCode={payment_code}      │
│                                                               │
│ Si yaExiste = true:                                          │
│   → La reserva ya fue creada automáticamente                │
│ Si yaExiste = false:                                          │
│   → Se crea la reserva manualmente (fallback)                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Pasos Detallados para el Frontend

### **Paso 1: Consultar Disponibilidad**

```javascript
const consultarDisponibilidad = async (filtros) => {
  const response = await fetch('https://gehsuitesapps.com/agencias/v1/booking-personas/disponibilidad', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${BOOKING_PERSONAS_TOKEN}`
    },
    body: JSON.stringify({
      city: filtros.city,           // "Cartagena", "Bogota", "Santa marta"
      checkin: filtros.checkin,     // "2025-02-22"
      nights: filtros.nights,        // 2
      adults: filtros.adults,        // 2
      children_ages: filtros.children_ages, // "10,14" (opcional)
      room_type: filtros.room_type  // "DOUBLE" (opcional)
    })
  });
  
  return await response.json();
};
```

**Uso:**
```javascript
const hoteles = await consultarDisponibilidad({
  city: 'Cartagena',
  checkin: '2025-02-22',
  nights: 2,
  adults: 2,
  children_ages: '10,14'
});

// Mostrar hoteles y habitaciones disponibles
hoteles.forEach(hotel => {
  console.log(`Hotel: ${hotel.hotel.name}`);
  hotel.availability.forEach(avail => {
    console.log(`  Habitaciones disponibles: ${avail.total_count}`);
    avail.available_rooms.forEach(room => {
      console.log(`    - ${room.roomName}: ${room.count} disponibles`);
    });
  });
});
```

---

### **Paso 2: Generar Link de Pago**

```javascript
const generarLinkPago = async (hotelId, datosPago, datosReserva) => {
  const response = await fetch(
    `https://gehsuitesapps.com/agencias/v1/booking-personas/generar-link-pago?hotelId=${hotelId}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOOKING_PERSONAS_TOKEN}`
      },
      body: JSON.stringify({
        hotel_id: hotelId,
        amount: datosPago.amount,
        currency: datosPago.currency || 'COP',
        guest_name: datosPago.guest_name,
        email: datosPago.email,
        phone: datosPago.phone,
        booking_dates: datosPago.booking_dates,
        description: datosPago.description,
        // ⚠️ IMPORTANTE: Incluir reservation_data para creación automática
        reservation_data: datosReserva
      })
    }
  );
  
  return await response.json();
};
```

**Uso:**
```javascript
const linkPago = await generarLinkPago(
  '13645', // hotelId
  {
    amount: 580000,
    currency: 'COP',
    guest_name: 'Juan Pérez',
    email: 'juan@example.com',
    phone: '+573001234567',
    booking_dates: '2025-02-22 - 2025-02-24',
    description: 'Pago para reserva de 2 noches en Hotel Azuan'
  },
  {
    // Datos completos de la reserva
    total: 580000,
    titularInfo: { ... },
    reservation: { ... },
    planAlimentario: 'Solo desayuno',
    // ... otros campos
  }
);

// Guardar payment_code para verificación posterior
localStorage.setItem('payment_code', linkPago.payment_code);

// Redirigir al usuario al link de pago
window.location.href = linkPago.payment_url;
```

---

### **Paso 3: Verificar/Crear Reserva (Después del Pago)**

```javascript
const verificarReserva = async (hotelId, paymentCode, datosReserva) => {
  const response = await fetch(
    `https://gehsuitesapps.com/agencias/v1/booking-personas/reservar?hotelId=${hotelId}&paymentCode=${paymentCode}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BOOKING_PERSONAS_TOKEN}`
      },
      body: JSON.stringify(datosReserva)
    }
  );
  
  return await response.json();
};
```

**Uso (en la página de éxito después del pago):**
```javascript
// Obtener payment_code de la URL o localStorage
const urlParams = new URLSearchParams(window.location.search);
const paymentCode = urlParams.get('payment_code') || localStorage.getItem('payment_code');

if (paymentCode) {
  const resultado = await verificarReserva(
    '13645', // hotelId
    paymentCode,
    datosReserva // Los mismos datos que se enviaron en generar-link-pago
  );
  
  if (resultado.yaExiste) {
    console.log('✅ Reserva ya fue creada automáticamente');
    console.log(`ID de reserva: ${resultado.reservaId}`);
    console.log(`Chatbot ID: ${resultado.chatbotId}`);
  } else {
    console.log('✅ Reserva creada exitosamente');
    console.log(`ID de reserva: ${resultado.reservaId}`);
  }
}
```

---

## ⚠️ Puntos Importantes

### 1. **Creación Automática de Reserva**
- Si incluyes `reservation_data` en `/generar-link-pago`, la reserva se creará **automáticamente** después del pago exitoso.
- Si **NO** incluyes `reservation_data`, debes crear la reserva manualmente usando `/reservar` después del pago.

### 2. **URLs de Redirección**
Las URLs de éxito/error están configuradas en el backend:
- `success_url`: `https://personas.gehsuites.com/reserva-exitosa`
- `failure_url`: `https://personas.gehsuites.com/reserva-error`

Puedes pasar el `payment_code` como query parameter:
```
https://personas.gehsuites.com/reserva-exitosa?payment_code=PAY-20250222-001
```

### 3. **Manejo de Errores**

```javascript
try {
  const resultado = await consultarDisponibilidad(filtros);
  // Procesar resultado
} catch (error) {
  if (error.response?.status === 401) {
    console.error('Token de autenticación inválido');
  } else if (error.response?.status === 400) {
    console.error('Datos inválidos:', error.response.data);
  } else {
    console.error('Error desconocido:', error);
  }
}
```

### 4. **Estados de Pago**
El webhook puede recibir estos estados:
- `"aplicado"` → Pago exitoso → Reserva se crea automáticamente
- `"rechazado"` → Pago rechazado
- `"cancelado"` → Pago cancelado
- `"en proceso"` → Pago en proceso

---

## 📊 Resumen de Endpoints

| Endpoint | Método | Autenticación | Descripción |
|----------|--------|---------------|-------------|
| `/disponibilidad` | POST | ✅ Static Token | Consultar disponibilidad de hoteles |
| `/generar-link-pago` | POST | ✅ Static Token | Generar link de pago |
| `/reservar` | POST | ✅ Static Token | Crear reserva (requiere pago previo) |
| `/change-status` | POST | ❌ Público | Webhook de Autocore (no usar desde frontend) |

---

## 🔑 Variables de Entorno Necesarias

```env
BOOKING_PERSONAS_TOKEN=tu-token-estatico-aqui
```

---

## 📝 Notas Finales

1. **Siempre incluye `reservation_data`** en `/generar-link-pago` para que la reserva se cree automáticamente.
2. **Guarda el `payment_code`** para poder verificar la reserva después del pago.
3. **El webhook es automático** - no necesitas hacer nada desde el frontend.
4. **Usa `/reservar` solo como fallback** si la creación automática falla.
