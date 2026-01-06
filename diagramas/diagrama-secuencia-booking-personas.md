# 📊 Diagrama de Secuencia - Booking Personas

## Flujo Completo con Creación Automática de Reserva

```mermaid
sequenceDiagram
    participant Frontend
    participant API as API Backend
    participant DB as MongoDB
    participant Autocore as Autocore API
    participant Payment as Payment Gateway

    Note over Frontend,Payment: PASO 1: Consultar Disponibilidad
    Frontend->>API: POST /disponibilidad<br/>{city, checkin, nights, adults}
    API->>Autocore: GET /v2/bookings/availability<br/>(múltiples hoteles en paralelo)
    Autocore-->>API: Disponibilidad de hoteles
    API-->>Frontend: Lista de hoteles disponibles

    Note over Frontend,Payment: PASO 2: Generar Link de Pago
    Frontend->>API: POST /generar-link-pago<br/>{amount, guest_name, email,<br/>reservation_data}
    API->>Autocore: POST /v2/links/schedule/<br/>{hotel_id, amount, guest_name, ...}<br/>(SIN reservation_id)
    Autocore-->>API: {url, code}
    API->>DB: Crear PaymentPending<br/>{payment_code, external_ref_id,<br/>status: PENDING, reservation_data}
    DB-->>API: PaymentPending creado
    API-->>Frontend: {payment_url, payment_code}

    Note over Frontend,Payment: PASO 3: Cliente Realiza el Pago
    Frontend->>Payment: Redirige a payment_url
    Payment->>Payment: Cliente completa el pago
    Payment->>Autocore: Procesa pago
    Autocore->>Payment: Pago confirmado

    Note over Frontend,Payment: PASO 4: Webhook Automático (Autocore)
    Autocore->>API: POST /change-status<br/>{external_ref_id, transaction_id,<br/>payment_status: "aplicado"}
    API->>DB: Buscar PaymentPending<br/>por external_ref_id
    DB-->>API: PaymentPending encontrado
    API->>DB: Actualizar PaymentPending<br/>{status: PAID, transaction_id, paid_at}
    API->>API: Verificar: reservation_data existe?
    
    alt reservation_data existe Y reserva_creada = false
        API->>Autocore: POST /v2/bookings/hotel_id={id}<br/>(Crear reserva)
        Autocore-->>API: {chatbot_id}
        API->>DB: Crear BookingPersona<br/>{status: 3, pagadoPrimeraMitad: true,<br/>paymenIds: [transaction_id]}
        DB-->>API: BookingPersona creado
        API->>DB: Actualizar PaymentPending<br/>{reserva_id, reserva_creada: true}
        DB-->>API: PaymentPending actualizado
    else reservation_data NO existe
        API->>API: Log: No hay datos de reserva
    end
    
    API-->>Autocore: {success: true, status: PAID}

    Note over Frontend,Payment: PASO 5: Frontend Verifica Reserva (Opcional)
    Frontend->>API: POST /reservar<br/>{paymentCode, ...}
    API->>DB: Buscar PaymentPending<br/>por payment_code
    DB-->>API: PaymentPending encontrado
    
    alt reserva_creada = true
        API->>DB: Buscar BookingPersona<br/>por reserva_id
        DB-->>API: BookingPersona encontrado
        API-->>Frontend: {reservaId, chatbotId,<br/>message: "Ya fue creada", yaExiste: true}
    else reserva_creada = false Y status = PAID
        API->>Autocore: POST /v2/bookings/hotel_id={id}<br/>(Crear reserva manualmente)
        Autocore-->>API: {chatbot_id}
        API->>DB: Crear BookingPersona
        DB-->>API: BookingPersona creado
        API->>DB: Actualizar PaymentPending<br/>{reserva_id, reserva_creada: true}
        API-->>Frontend: {reservaId, chatbotId,<br/>message: "Reserva creada exitosamente"}
    else status != PAID
        API-->>Frontend: Error 400: Pago no completado
    end
```

## Estados de los Documentos en la Base de Datos

### Estado Inicial (Después de PASO 2)
```json
// payment_pending_personas
{
  "status": "pending",
  "reserva_creada": false,
  "reserva_id": null
}

// bookingpersonas
(No existe aún)
```

### Estado Final (Después de PASO 4)
```json
// payment_pending_personas
{
  "status": "paid",
  "reserva_creada": true,
  "reserva_id": "65f1a2b3c4d5e6f7g8h9i0j2",
  "transaction_id": "TXN-ABC123XYZ789",
  "paid_at": "2025-01-22T10:35:00.000Z"
}

// bookingpersonas
{
  "_id": "65f1a2b3c4d5e6f7g8h9i0j2",
  "status": 3,  // Pago Aprobado
  "pagadoPrimeraMitad": true,
  "paymenIds": ["TXN-ABC123XYZ789"],
  "reservaChatbotId": "BK-00230690"
}
```

