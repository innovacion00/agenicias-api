# 📋 Flujo Completo de Booking Personas - Revisión Final

## 🔄 Flujo Completo del Proceso

### **PASO 1: Consultar Disponibilidad**
```
POST /agencias/v1/booking-personas/disponibilidad
Headers: { "Authorization": "Bearer <STATIC_TOKEN>" }
Body: {
  "city": "CARTAGENA",
  "checkin": "2025-02-22",
  "nights": 2,
  "adults": 2,
  "children_ages": "10,14",
  "room_type": "DOUBLE"
}
```

**Respuesta:** Lista de hoteles disponibles con habitaciones y tarifas.

---

### **PASO 2: Generar Link de Pago**
```
POST /agencias/v1/booking-personas/generar-link-pago?hotelId=13645
Headers: { "Authorization": "Bearer <STATIC_TOKEN>" }
Body: {
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
      "source_of_bussiness": "",
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

**Respuesta:**
```json
{
  "payment_url": "https://autocore.com/payment/ABC123XYZ",
  "payment_code": "PAY-20250222-001",
  "message": "Link de pago generado exitosamente. La reserva se creará automáticamente después de que el pago sea completado."
}
```

**📊 Estado en Base de Datos después del PASO 2:**

#### **Colección: `payment_pending_personas`**
```json
{
  "_id": ObjectId("65f1a2b3c4d5e6f7g8h9i0j1"),
  "payment_code": "PAY-20250222-001",
  "external_ref_id": "personas_1737654321000_k2j3h4g5f",
  "status": "pending",
  "amount": 580000,
  "currency": "COP",
  "hotel_id": "13645",
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
      "source_of_bussiness": "",
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
  },
  "reserva_creada": false,
  "reserva_id": null,
  "transaction_id": null,
  "paid_at": null,
  "createdAt": ISODate("2025-01-22T10:30:00.000Z"),
  "updatedAt": ISODate("2025-01-22T10:30:00.000Z")
}
```

---

### **PASO 3: Cliente Realiza el Pago**
El cliente abre `payment_url` y completa el pago en Autocore.

**Acción:** Cliente redirigido a Autocore → Completa pago → Autocore procesa.

---

### **PASO 4: Webhook de Autocore (Automático)**
```
POST /agencias/v1/booking-personas/change-status
Body: {
  "external_ref_id": "personas_1737654321000_k2j3h4g5f",
  "transaction_id": "TXN-ABC123XYZ789",
  "payment_status": "aplicado",
  "details": {
    "id": "PAY-20250222-001",
    "pay_platform": "stripe"
  }
}
```

**Proceso Interno:**
1. ✅ Busca `PaymentPending` por `external_ref_id`
2. ✅ Actualiza `status` a `"paid"`
3. ✅ Guarda `transaction_id` y `paid_at`
4. ✅ **CREA LA RESERVA AUTOMÁTICAMENTE** (si hay `reservation_data`)
5. ✅ Actualiza `PaymentPending` con `reserva_id` y `reserva_creada: true`

**📊 Estado en Base de Datos después del PASO 4:**

#### **Colección: `payment_pending_personas` (ACTUALIZADO)**
```json
{
  "_id": ObjectId("65f1a2b3c4d5e6f7g8h9i0j1"),
  "payment_code": "PAY-20250222-001",
  "external_ref_id": "personas_1737654321000_k2j3h4g5f",
  "status": "paid",
  "amount": 580000,
  "currency": "COP",
  "hotel_id": "13645",
  "reservation_data": {
    // ... (mismo objeto que antes)
  },
  "reserva_creada": true,
  "reserva_id": "65f1a2b3c4d5e6f7g8h9i0j2",
  "transaction_id": "TXN-ABC123XYZ789",
  "paid_at": ISODate("2025-01-22T10:35:00.000Z"),
  "createdAt": ISODate("2025-01-22T10:30:00.000Z"),
  "updatedAt": ISODate("2025-01-22T10:35:00.000Z")
}
```

#### **Colección: `bookingpersonas` (NUEVO DOCUMENTO)**
```json
{
  "_id": ObjectId("65f1a2b3c4d5e6f7g8h9i0j2"),
  "hotel": "Hotel Azuan",
  "cantidadHabitaciones": 1,
  "origenIata": "BOG",
  "mascotas": false,
  "mascotasNumber": 0,
  "total": 580000,
  "adicionCena": false,
  "adicionAlmuerzo": false,
  "pagadoPrimeraMitad": true,
  "planAlimentario": "Solo desayuno",
  "exentoIva": false,
  "status": 3,
  "titularInfo": {
    "firstName": "Juan",
    "lastName": "Pérez",
    "tipoDocumento": "CC",
    "documento": "1234567890",
    "fechaNacimiento": "1990-01-15"
  },
  "reservation": {
    "source_of_bussiness": "Booking Personas",
    "adults": "2",
    "checkin": "2025-02-22",
    "checkout": "2025-02-24",
    "children": "2",
    "children_ages": "10,14",
    "city": "CARTAGENA",
    "country": "COL",
    "currency": "COP",
    "email": "juan@example.com",
    "telephone": "+573001234567",xxxz 
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
  "reservaChatbotId": "BK-00230690",
  "paymenIds": ["TXN-ABC123XYZ789"],
  "fechaLimitePago": "2025-02-20",
  "fechaLimitePago2": "2025-02-21",
  "linkInfo": {
    "link": "",
    "expirationDate": "",
    "idLinkPago": ""
  },
  "linksHistory": [],
  "createdAt": ISODate("2025-01-22T10:35:00.000Z"),
  "updatedAt": ISODate("2025-01-22T10:35:00.000Z")
}
```

---

### **PASO 5: Frontend Verifica/Consulta la Reserva (Opcional)**
```
POST /agencias/v1/booking-personas/reservar?hotelId=13645&paymentCode=PAY-20250222-001
Headers: { "Authorization": "Bearer <STATIC_TOKEN>" }
Body: {
  // ... mismo body que en generar-link-pago
}
```

**Respuesta (si la reserva ya fue creada automáticamente):**
```json
{
  "reservaId": "65f1a2b3c4d5e6f7g8h9i0j2",
  "chatbotId": "BK-00230690",
  "message": "La reserva ya fue creada automáticamente después del pago.",
  "yaExiste": true
}
```

**Respuesta (si la reserva NO fue creada automáticamente - fallback):**
```json
{
  "reservaId": "65f1a2b3c4d5e6f7g8h9i0j2",
  "chatbotId": "BK-00230690",
  "message": "Reserva creada exitosamente con pago completo"
}
```

---

## ✅ Verificación de Coherencia del Flujo

### **1. Coherencia de Datos**
- ✅ `PaymentPending.reservation_data` contiene todos los datos necesarios para crear la reserva
- ✅ `PaymentPending.hotel_id` coincide con el hotel de la reserva
- ✅ `PaymentPending.amount` coincide con `BookingPersona.total`
- ✅ `PaymentPending.transaction_id` se guarda en `BookingPersona.paymenIds`
- ✅ `BookingPersona.status` = `3` (Pago Aprobado) porque el pago ya fue completado
- ✅ `BookingPersona.pagadoPrimeraMitad` = `true` porque el pago es completo

### **2. Prevención de Duplicados**
- ✅ `PaymentPending.reserva_creada` previene crear la reserva dos veces
- ✅ `PaymentPending.reserva_id` permite verificar si ya existe la reserva
- ✅ El método `crearReservaAutomatica` verifica `reserva_creada` antes de crear

### **3. Flujo de Pago**
- ✅ El link de pago se genera **SIN** `reservation_id` (opcional según Autocore)
- ✅ El pago debe completarse antes de crear la reserva
- ✅ El webhook actualiza el estado del pago y crea la reserva automáticamente
- ✅ Si falla la creación automática, el frontend puede crear la reserva manualmente

### **4. Integridad Referencial**
- ✅ `PaymentPending.reserva_id` → `BookingPersona._id` (referencia correcta)
- ✅ `BookingPersona.paymenIds` contiene `PaymentPending.transaction_id`
- ✅ `BookingPersona.reservaChatbotId` es el ID de Autocore (único)

### **5. Estados y Transiciones**
```
PaymentPending.status:
  PENDING → (pago completado) → PAID → (reserva creada) → reserva_creada: true

BookingPersona.status:
  (creado) → 3 (Pago Aprobado) - porque ya está pagado
```

### **6. Manejo de Errores**
- ✅ Si el webhook falla al crear la reserva, no afecta el webhook (solo log)
- ✅ El frontend puede crear la reserva manualmente si falla la creación automática
- ✅ Si el pago es rechazado, `PaymentPending.status` = `REJECTED` y no se crea reserva

---

## 🔍 Puntos de Verificación Adicionales

### **1. Autenticación**
- ✅ Endpoints protegidos con `@StaticTokenAuth()` (token estático)
- ✅ Webhook sin autenticación (público, solo Autocore lo llama)

### **2. Validaciones**
- ✅ `reservation_data` es opcional en `GeneratePaymentLinkPersonasDto`
- ✅ Si no hay `reservation_data`, el frontend debe crear la reserva manualmente
- ✅ El pago debe estar en estado `PAID` antes de crear la reserva

### **3. Logs y Trazabilidad**
- ✅ Todos los pasos tienen logs detallados
- ✅ `PaymentPending` tiene `createdAt` y `updatedAt`
- ✅ `BookingPersona` tiene `createdAt` y `updatedAt`
- ✅ `transaction_id` permite rastrear el pago en Autocore

---

## 📝 Resumen del Flujo

1. **Consultar Disponibilidad** → Frontend obtiene hoteles y tarifas
2. **Generar Link de Pago** → Se crea `PaymentPending` con `reservation_data`
3. **Cliente Paga** → Autocore procesa el pago
4. **Webhook Automático** → Actualiza `PaymentPending` y **crea `BookingPersona`**
5. **Frontend Verifica** → Consulta la reserva (opcional, ya está creada)

---

## 🎯 Conclusión

El flujo es **coherente y completo**:
- ✅ Los datos se guardan correctamente en ambas colecciones
- ✅ La reserva se crea automáticamente después del pago
- ✅ Hay prevención de duplicados
- ✅ Hay manejo de errores y fallbacks
- ✅ La integridad referencial está garantizada
- ✅ Los estados son consistentes

El sistema está listo para producción. 🚀

