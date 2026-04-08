# Resumen de la base de datos – Documentos y campos

Documento de referencia de las colecciones MongoDB usadas en la API y el significado de cada campo. Los modelos están definidos con Mongoose en `src/**/entities/*.entity.ts`.

---

## 1. Reserva (reservas)

Almacena las reservas de hoteles realizadas por agencias (flujo agencias, no personas).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **userId** | ObjectId (ref: User) | Usuario que creó la reserva. |
| **agenciaId** | ObjectId (ref: Agencia) | Agencia a la que pertenece la reserva. |
| **hotel** | String (1–200) | Nombre del hotel. |
| **cantidadHabitaciones** | Number (1–100) | Número de habitaciones. |
| **origenIata** | String | Código IATA de origen (opcional). |
| **mascotas** | Boolean | Si se incluyen mascotas. |
| **mascotasNumber** | Number | Cantidad de mascotas. |
| **total** | Number | Valor total de la reserva (debe ser > 0). |
| **totalMitad** | Number | Monto del primer abono (mitad); default 0. |
| **adicionCena** | Boolean | Adición de cena. |
| **adicionAlmuerzo** | Boolean | Adición de almuerzo. |
| **pagadoPrimeraMitad** | Boolean | Si ya se pagó el primer abono. |
| **planAlimentario** | String | Descripción del plan alimentario. |
| **infoTransporte** | Object | Datos de traslado: numeroVuelo, numeroVueloSalida, aerolinea, tipoRecogida (0=ida hotel, 1=ida aeropuerto, 2=ida y vuelta), firstContactNumber, secondContacNumber, cantidadPersonas. |
| **infoToures** | Object | Datos de tours: nombres (array), firstContactNumber, secondContacNumber. |
| **reteFuente** | Object | Retención en la fuente: porcentaje, resultado. |
| **reteIva** | Object | Retención IVA: porcentaje, resultado. |
| **reteIca** | Object | Retención ICA: porcentaje, resultado. |
| **exentoIva** | Boolean | Si está exento de IVA. |
| **status** | Number (enum) | Estado de pago: 0=espera, 1=proceso, 2=rechazado, 3=total (pagado), 4=cancelado, 5=mitad (primer abono pagado). |
| **cancelInProgress** | Boolean | Indica si hay una cancelación en curso. |
| **cancelRequestedAt** | Date | Cuándo se solicitó la cancelación. |
| **cancelProcessedAt** | Date | Cuándo se procesó la cancelación. |
| **cancelOpId** | String | Identificador de la operación de cancelación (ej. en Autocore). |
| **asistentes** | Array | Asistentes: fullName, tipoDocumento (CC/NIT/CE/PA), documento, telefono, email. |
| **titularInfo** | Object | Titular: firstName, lastName, tipoDocumento, documento, fechaNacimiento. |
| **reservation** | Object | Payload de reserva (Autocore/chatbot): source_of_bussiness, adults, checkin, checkout, children, city, country, currency, email, telephone, firstName, lastName, nights, notes, rooms, roomsData (habitaciones con nombreHabitacion, adults, children, checkin, checkout, currency, id, quantity, rateId, unitaryPrice). |
| **reservaChatbotId** | String | Código único de la reserva (usado en URLs y notificaciones). |
| **paymenIds** | [String] | IDs de pagos registrados. |
| **fechaLimitePago** | String | Fecha límite del primer pago (formato recomendado YYYY-MM-DD). |
| **fechaLimitePago2** | String | Fecha límite del segundo pago. |
| **notasSuperAdmin** | String | Notas internas del super admin. |
| **notasagencias** | String | Notas de la agencia. |
| **linkInfo** | Object | Link de pago: link (URL), expirationDate, idLinkPago. |
| **linksHistory** | Array | Historial de links de pago: id, typeOfPayment, state, fecha. |
| **createdAt** / **updatedAt** | Date | Timestamps (por `timestamps: true`). |

### Significado del status (Reserva)

| Valor | Nombre   | Significado |
|-------|----------|-------------|
| **0** | espera   | Pendiente de pago: la reserva está creada pero aún no se ha iniciado o completado ningún pago. |
| **1** | proceso  | En proceso de pago: el usuario tiene un link de pago abierto o el pago está siendo procesado por la pasarela. |
| **2** | rejected | Pago rechazado: el intento de pago fue rechazado (tarjeta, fondos, etc.). |
| **3** | total    | Pago completo: la reserva está totalmente pagada (primer y segundo abono realizados). |
| **4** | cancelado| Reserva cancelada: ya sea por el usuario, por vencimiento de fechas límite o por otro motivo. |
| **5** | mitad    | Primer abono pagado: se pagó la primera mitad; queda pendiente el segundo pago antes de `fechaLimitePago2`. |

---

## 2. Agencia (agencias)

Datos de las agencias de viajes (mayoristas o minoristas) que usan la plataforma.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **emailContacto** | String | Email de contacto (único). |
| **telefonoContacto** | String | Teléfono de contacto. |
| **fullName** | String (2–200) | Nombre completo de la agencia. |
| **slug** | String | Identificador único en URL (ej. nombre-normalizado). |
| **saldo** | Number | Saldo disponible (no negativo). |
| **category** | Number (0 o 1) | 0 = minorista, 1 = mayorista. |
| **documentInfo** | Object | tipo (CC/NIT/CE/PA), document (número único). |
| **cobreInfo** | Object | Integración Cobre: bolcilloId, counterPartyId. |
| **autocoreInfo** | Object | Integración Autocore: id. |
| **empresa** | Boolean | Si es empresa (vs persona natural). |
| **isActive** | Boolean | Si la agencia está activa. |
| **usuarios** | [ObjectId] (ref: User) | Usuarios asociados a la agencia. |
| **userLimit** | Number (1–100) | Límite de usuarios permitidos. |
| **permisoCartera** | Boolean | Si tiene permiso de cartera. |
| **politicasAgencia** | String | Texto de políticas aceptadas. |
| **createdAt** / **updatedAt** | Date | Timestamps. |

### Significado de category (Agencia)

| Valor | Significado |
|-------|-------------|
| **0** | Minorista. |
| **1** | Mayorista. |

---

## 3. User (users)

Usuarios del sistema (agentes de agencias o admins).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **email** | String | Email (único, lowercase). |
| **password** | String | Contraseña hasheada (no se devuelve por defecto, `select: false`). |
| **telefono** | String | Teléfono (formato E.164). |
| **fullName** | String (2–100) | Nombre completo. |
| **isActive** | Boolean | Si el usuario está activo. |
| **settings** | Object | omitirOtp: si se omite OTP en login. |
| **firstLog** | Boolean | Si es el primer inicio de sesión. |
| **role** | [String] | Roles: ej. admin, user (según ValidRoles). |
| **imageUrl** | String | URL de foto de perfil. |
| **agencia** | ObjectId (ref: Agencia) | Agencia a la que pertenece el usuario. |
| **otpRef** | ObjectId (ref: OtpVerification) | Referencia al OTP actual (si aplica). |
| **reservas** | [ObjectId] (ref: Reserva) | Reservas asociadas (referencia). |
| **eventos** | [ObjectId] (ref: Evento) | Eventos asociados. |
| **politicasAgencia** | String | Políticas aceptadas por el usuario. |
| **createdAt** / **updatedAt** | Date | Timestamps. |

---

## 4. RefreshToken (refresh_tokens)

Sesiones / tokens de refresco para mantener al usuario logueado.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **userId** | ObjectId (ref: User) | Usuario dueño del token. |
| **token** | String | Valor del refresh token (único). |
| **expiresAt** | Date | Fecha de expiración. |
| **isActive** | Boolean | Si la sesión sigue activa. |
| **createdAt** | Date | Creación. |
| **updatedAt** | Date | Última actualización. |

---

## 5. OtpVerification (otpverifications)

Códigos OTP para verificación (ej. login en dos pasos).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **userId** | ObjectId (ref: User) | Usuario (único por usuario). |
| **otp** | String | Código OTP generado. |
| **usado** | Boolean | Si el OTP ya fue usado. |
| **expiresAt** | Number (Date) | Fecha/hora de expiración. |
| **createdAt** / **updatedAt** | Date | Timestamps. |

---

## 6. BookingPersona (bookingpersonas)

Reservas del flujo “personas” (booking directo, no por agencia). Estructura similar a Reserva pero sin agencia/user de agencia.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **hotel** | String | Nombre del hotel. |
| **cantidadHabitaciones** | Number | Número de habitaciones. |
| **origenIata** | String | Código IATA de origen. |
| **mascotas** / **mascotasNumber** | Boolean, Number | Mascotas. |
| **total** | Number | Total de la reserva. |
| **adicionCena** / **adicionAlmuerzo** | Boolean | Adiciones. |
| **pagadoPrimeraMitad** | Boolean | Primer abono pagado. |
| **planAlimentario** | String | Plan de alimentación. |
| **exentoIva** | Boolean | Exento IVA. |
| **status** | Number (enum) | Mismo enum que Reserva: 0–5 (espera, proceso, rechazado, total, cancelado, mitad). |
| **titularInfo** | Object | Titular: firstName, lastName, tipoDocumento, documento, fechaNacimiento. |
| **reservation** | Object | Misma estructura que en Reserva (datos de habitaciones, fechas, etc.). |
| **reservaChatbotId** | String | Código único de la reserva. |
| **paymenIds** | [String] | IDs de pagos. |
| **fechaLimitePago** / **fechaLimitePago2** | String | Fechas límite de pago. |
| **linkInfo** | Object | link, expirationDate, idLinkPago. |
| **linksHistory** | Array | Historial de links de pago. |
| **createdAt** / **updatedAt** | Date | Timestamps. |

### Significado del status (BookingPersona)

Usa el mismo enum que **Reserva** (ValidPaymentStatus). Significado de cada valor:

| Valor | Nombre   | Significado |
|-------|----------|-------------|
| **0** | espera   | Pendiente de pago. |
| **1** | proceso  | En proceso de pago. |
| **2** | rejected | Pago rechazado. |
| **3** | total    | Pago completo. |
| **4** | cancelado| Reserva cancelada. |
| **5** | mitad    | Primer abono pagado; pendiente segundo pago. |

---

## 7. PaymentPending (payment_pending_personas)

Pagos pendientes del flujo personas; se usa para crear la reserva cuando se confirma el pago.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **payment_code** | String | Código único del pago. |
| **external_ref_id** | String | Referencia externa (ej. pasarela). |
| **status** | String (enum) | pending, paid, rejected, cancelled. |
| **amount** | Number | Monto. |
| **currency** | String | Moneda. |
| **transaction_id** | String | ID de transacción del proveedor. |
| **paid_at** | Date | Fecha de pago. |
| **hotel_id** | String | Identificador del hotel. |
| **reservation_data** | Object | Datos para crear la reserva al confirmar pago. |
| **reserva_id** | String | ID de la reserva creada (evitar duplicados). |
| **reserva_creada** | Boolean | Si ya se creó la reserva. |
| **createdAt** / **updatedAt** | Date | Timestamps. |

### Significado del status (PaymentPending)

| Valor        | Significado |
|-------------|-------------|
| **pending** | El pago fue generado pero aún no se ha confirmado por la pasarela; la reserva no se ha creado. |
| **paid**    | El pago fue confirmado; normalmente ya se creó la reserva en BookingPersona y `reserva_creada` es true. |
| **rejected**| El pago fue rechazado por la pasarela o no se completó. |
| **cancelled** | El pago fue cancelado (ej. por el usuario o por tiempo expirado). |

---

## 8. Cotizacion (cotizaciones)

Cotizaciones enviadas a clientes (landing + token); pueden convertirse en reserva.

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **userId** | ObjectId (ref: User) | Usuario que creó la cotización. |
| **agenciaId** | ObjectId (ref: Agencia) | Agencia. |
| **hotel** | String | Hotel. |
| **cantidadHabitaciones** | Number | Habitaciones. |
| **origenIata**, **mascotas**, **mascotasNumber** | Varios | Igual que en reserva. |
| **total** | Number | Total. |
| **markup** | Number | Markup aplicado. |
| **porcentajemarkup** | Number | Porcentaje de markup. |
| **totalMitad** | Number | Monto primera mitad. |
| **adicionCena** / **adicionAlmuerzo** / **planAlimentario** | Varios | Igual que reserva. |
| **infoTransporte** / **infoToures** | Object | Transporte y tours (misma forma que Reserva). |
| **reteFuente** / **reteIva** / **reteIca** | Object | Retenciones. |
| **exentoIva** | Boolean | Exento IVA. |
| **status** | Number (enum) | 0=espera, 1=aceptada, 2=rechazada, 3=convertida en reserva. |
| **asistentes** | Array | Misma estructura que en Reserva. |
| **titularInfo** | Object | Titular. |
| **reservation** | Object | Datos de reserva (habitaciones, fechas, etc.). |
| **cotizacionChatbotId** | String | ID de cotización en el chatbot. |
| **fechaLimiteRespuesta** | String | Fecha límite para aceptar/rechazar. |
| **notasSuperAdmin** | String | Notas internas. |
| **landingUrl** | String | URL de la landing de la cotización. |
| **landingHtml** | String | HTML de la landing. |
| **pdfUrl** | String | URL del PDF generado. |
| **pdfCloudinaryId** | String | ID en Cloudinary del PDF. |
| **tokenAcceso** | String | Token para acceder a la cotización (único). |
| **fechaAprobacion** / **fechaRechazo** | Date | Fechas de respuesta. |
| **motivoRechazo** | String | Motivo si fue rechazada. |
| **reservaId** | ObjectId (ref: Reserva) | Reserva creada al aceptar (si aplica). |
| **createdAt** / **updatedAt** | Date | Timestamps. |

### Significado del status (Cotizacion)

| Valor | Nombre              | Significado |
|-------|---------------------|-------------|
| **0** | EN_ESPERA           | La cotización fue enviada al cliente y está pendiente de que acepte o rechace antes de `fechaLimiteRespuesta`. |
| **1** | ACEPTADA            | El cliente aceptó la cotización; se puede proceder a crear la reserva (y se guarda en `reservaId`). |
| **2** | RECHAZADA           | El cliente rechazó la cotización; opcionalmente se guarda el motivo en `motivoRechazo`. |
| **3** | CONVERTIDA_RESERVA  | La cotización fue aceptada y ya se creó la reserva asociada (referenciada en `reservaId`). |

---

## 9. Evento (eventos)

Solicitudes de eventos (corporativos, sociales, culturales).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **userId** | ObjectId (ref: User) | Usuario que crea el evento. |
| **agenciaId** | ObjectId (ref: Agencia) | Agencia. |
| **nameEvento** | String | Nombre del evento. |
| **tipoEvento** | Number (enum) | 1=corporativo, 2=social, 3=cultural. |
| **nombreOrganizador** | String | Nombre del organizador. |
| **telefonoOrganizador** | String | Teléfono. |
| **emailOrganizador** | String | Email. |
| **cantidadAsistentes** | Number | Número de asistentes. |
| **fechaInicioEvento** / **fechaFinalEvento** | Date/String | Rango de fechas del evento. |
| **horarioEvento** | Array | Por día: fechaInicio, fechaFinal, cantidadAsistenteDia. |
| **flexibilidadEvento** | Boolean | Si hay flexibilidad de fechas. |
| **tipoAcomodacion** | Number (enum) | 1=auditorio, 2=aulaSalon, 3=cuadrada, 4=redonda, 5=mesasU. |
| **alimentacion** | Boolean | Si requiere alimentación. |
| **alimentosBebidas** | Object | estacionCafe, coffeBreak, desayuno, almuerzo, cena. |
| **audiovisuales** | Boolean | Si requiere equipo audiovisual. |
| **itemsAudiovisuales** | [String] | Listado de ítems. |
| **decoracion** | Boolean | Si requiere decoración. |
| **decoracionDescripcion** | String | Descripción. |
| **alojamiento** | Boolean | Si requiere alojamiento. |
| **observaciones** | String | Observaciones generales. |
| **createdAt** / **updatedAt** | Date | Timestamps. |

### Significado de tipoEvento y tipoAcomodacion (Evento)

**tipoEvento:**

| Valor | Nombre      | Significado |
|-------|-------------|-------------|
| **1** | corporativo | Evento corporativo (empresas, reuniones). |
| **2** | social      | Evento social (bodas, cumpleaños, etc.). |
| **3** | cultural    | Evento cultural. |

**tipoAcomodacion:**

| Valor | Nombre     | Significado |
|-------|------------|-------------|
| **1** | auditorio  | Disposición en auditorio. |
| **2** | aulaSalon  | Aula o salón. |
| **3** | cuadrada   | Mesas cuadradas. |
| **4** | redonda    | Mesas redondas. |
| **5** | mesasU     | Mesas en forma de U. |

---

## 10. Integration (integrations)

Integraciones externas por API key (ej. Autocore prod/dev).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| **name** | String | Nombre único de la integración (lowercase). |
| **apiKey** | String | API key (única). |
| **secretKey** | String | Clave secreta. |
| **isActive** | Boolean | Si está activa. |
| **roles** | [String] | Roles permitidos (ej. autocore-prod, autocore-dev). |
| **createdAt** / **updatedAt** | Date | Timestamps. |

---

## Enums de referencia (resumen)

- **ValidPaymentStatus (Reserva, BookingPersona):** 0=espera, 1=proceso, 2=rejected, 3=total, 4=cancelado, 5=mitad. Detalle en las secciones de Reserva y BookingPersona.
- **ValidTipoRecogida (transporte):** 0=ida hotel, 1=ida aeropuerto, 2=ida y vuelta.
- **CotizacionStatus:** 0=EN_ESPERA, 1=ACEPTADA, 2=RECHAZADA, 3=CONVERTIDA_RESERVA. Detalle en la sección Cotizacion.
- **PaymentStatus (PaymentPending):** pending, paid, rejected, cancelled. Detalle en la sección PaymentPending.
- **TipoEvento:** 1=corporativo, 2=social, 3=cultural. Detalle en la sección Evento.
- **TipoAcomodacion:** 1=auditorio, 2=aulaSalon, 3=cuadrada, 4=redonda, 5=mesasU. Detalle en la sección Evento.
- **ValidIntegrationsRoles:** autocore-prod, autocore-dev (y los que se definan en auth/interfaces).

Si se añaden nuevos documentos o campos, conviene actualizar este archivo y los comentarios en las entidades.
