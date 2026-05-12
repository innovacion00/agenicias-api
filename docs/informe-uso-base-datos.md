# Informe de uso de base de datos (MongoDB)

Este documento describe, con ejemplos prácticos del proyecto, cómo se maneja:

1. conexión a base de datos,
2. creación de registros de reserva,
3. persistencia de información de vuelos en reservas,
4. uso de la colección de referencia de aeropuertos,
5. almacenamiento y resolución de credenciales `maarlab_partner_credentials`.

---

## 1) Conexión a la base de datos

La aplicación usa `@nestjs/mongoose` y se conecta en `AppModule` con `MongooseModule.forRoot(envs.mongoUrl, ...)`.

### Variables de entorno clave

- `MONGO_URL`: URI de MongoDB.
- `PORT`: puerto de la API.

### Ejemplo de `.env`

```env
PORT=3000
MONGO_URL=mongodb://localhost:27017/agenicias
```

### Configuración aplicada

La conexión usa opciones de producción relevantes:

- `maxPoolSize: 10`
- `minPoolSize: 2`
- `serverSelectionTimeoutMS: 5000`
- `socketTimeoutMS: 45000`
- `retryWrites: true`
- `retryReads: true`

Esto permite estabilidad de conexión y control de tiempos de espera.

---

## 2) Registro de modelos por módulo

Cada colección se registra con `MongooseModule.forFeature`, por ejemplo:

- `ReservasModule` registra el modelo `Reserva`.
- `ReferenciaAeropuertosModule` registra `AeropuertoReferencia`.
- `MaarlabCredentialsModule` registra `MaarlabPartnerCredential`.

Con eso, los servicios inyectan modelos usando `@InjectModel(...)`.

---

## 3) Cómo crear un registro de reserva

### Endpoint principal

- `POST /agencias/v1/reservas/reservar?hotelId=<hotelId>`
- Requiere JWT.
- Servicio: `ReservasService.createReserva(...)`.

### Qué pasa en BD al crear una reserva

1. Se valida usuario/agencia.
2. Se crea reserva en Autocore (servicio externo).
3. Se inicia transacción MongoDB.
4. Se inserta documento en colección `reservas`.
5. Se hace `push` del `_id` de la reserva en `user.reservas`.
6. Se confirma transacción.

### Ejemplo de request

```bash
curl -X POST "http://localhost:3000/agencias/v1/reservas/reservar?hotelId=hotel_demo" ^
  -H "Authorization: Bearer <JWT>" ^
  -H "Content-Type: application/json" ^
  -d "{
    \"total\": 2450000,
    \"mascotas\": false,
    \"mascotasNumber\": 0,
    \"origenIata\": \"BOG\",
    \"adicionCena\": true,
    \"adicionAlmuerzo\": false,
    \"titularInfo\": {
      \"firstName\": \"Carlos\",
      \"lastName\": \"Perez\",
      \"tipoDocumento\": \"CC\",
      \"documento\": \"1000111222\",
      \"fechaNacimiento\": \"1990-01-15\"
    },
    \"reservaInfo\": {
      \"agency\": {
        \"is_agency\": true,
        \"agency_type\": 1,
        \"external_ref_id\": \"BOL-12345\"
      },
      \"reservation\": {
        \"adults\": \"2\",
        \"checkin\": \"2026-08-01\",
        \"checkout\": \"2026-08-05\",
        \"children\": \"1\",
        \"children_ages\": \"6\",
        \"city\": \"cartagena\",
        \"country\": \"COL\",
        \"currency\": \"COP\",
        \"email\": \"cliente@example.com\",
        \"telephone\": \"+573001112233\",
        \"firstName\": \"Carlos\",
        \"lastName\": \"Perez\",
        \"nights\": \"4\",
        \"notes\": \"Reserva de prueba\",
        \"rooms\": \"1\",
        \"roomsData\": [
          {
            \"nombreHabitacion\": \"doble estandar\",
            \"adults\": \"2\",
            \"children\": \"1\",
            \"children_ages\": \"6\",
            \"checkin\": \"2026-08-01\",
            \"checkout\": \"2026-08-05\",
            \"currency\": \"COP\",
            \"id\": \"ROOM-01\",
            \"quantity\": \"1\",
            \"rateId\": \"RATE-01\",
            \"unitaryPrice\": 612500
          }
        ]
      }
    }
  }"
```

### Ejemplo de documento persistido (resumen)

```json
{
  "_id": "68218f7e3b9f2a1f4d7c9301",
  "userId": "68218f7e3b9f2a1f4d7c9101",
  "agenciaId": "68218f7e3b9f2a1f4d7c9001",
  "hotel": "hotel costa demo",
  "total": 2450000,
  "totalMitad": 1225000,
  "reservaChatbotId": "CB88D9393D",
  "status": 0,
  "reservation": { "...": "..." },
  "vuelo": []
}
```

---

## 4) Cómo se guarda la información de vuelos en `Reserva.vuelo`

El campo `vuelo` vive dentro de la colección `reservas` y es un `array` de objetos:

```ts
vuelo: Array<{
  packageId: string;
  respuestaMaarLab: Record<string, any>;
  createdAt: Date;
}>
```

### Flujo real de guardado

1. Se llama `POST /agencias/v1/vuelos/maarlab/reservar`.
2. El body incluye `packageId`, `passengers` y `reservaChatbotId`.
3. El servicio `VuelosService.bookPackageMaarLab(...)`:
   - reserva en MaarLab,
   - busca la reserva por `reservaChatbotId`,
   - agrega un elemento a `reserva.vuelo` con:
     - `packageId`,
     - `respuestaMaarLab` (respuesta completa menos `hotel`),
     - `createdAt`.

### Ejemplo de request (reserva de paquete)

```bash
curl -X POST "http://localhost:3000/agencias/v1/vuelos/maarlab/reservar?info=all" ^
  -H "Authorization: Bearer <JWT>" ^
  -H "Content-Type: application/json" ^
  -d "{
    \"packageId\": \"PKG-ANON-001\",
    \"reservaChatbotId\": \"CB88D9393D\",
    \"passengers\": [
      {
        \"passengerId\": \"1\",
        \"type_passenger\": \"adult\",
        \"title\": \"Mr\",
        \"name\": \"Carlos\",
        \"surname\": \"Perez\",
        \"email\": \"cliente@example.com\",
        \"contact_number\": \"+57 3001112233\",
        \"date_of_birth\": \"1990-01-15\",
        \"document_type\": \"IDENTITY_CARD\",
        \"document_number\": \"1000111222\",
        \"document_issuance\": \"CO\",
        \"document_expiration\": \"2030-01-15\",
        \"document_issuance_date\": \"2020-01-15\",
        \"document_residence\": \"CO\",
        \"country_id\": \"CO\",
        \"address\": \"Calle 1\",
        \"province\": \"Cundinamarca\",
        \"city\": \"Bogota\",
        \"postalcode\": \"110111\"
      }
    ]
  }"
```

### Resultado en Mongo (append en `vuelo`)

```json
{
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

---

## 5) Uso de la colección de aeropuertos (`aeropuertos_referencia`)

### Propósito

Catálogo local para búsqueda predictiva de aeropuertos (sin depender en tiempo real de APIs externas).

### Carga inicial (seed)

Script: `scripts/seed-airports.ts`

```bash
npm run seed:airports -- "C:\ruta\airports.json"
```

Opciones útiles:

- `--clear`: limpia la colección antes de cargar.
- `--indexes-only`: solo sincroniza índices.

### Endpoints de uso

- `GET /agencias/v1/referencia-aeropuertos/sugerencias?q=bog&limit=20&country=CO`
- `GET /agencias/v1/referencia-aeropuertos/estado`

### Lógica de búsqueda

- Si el texto tiene espacios: intenta búsqueda `full-text`.
- Si no: busca por prefijo en `normName`, `normCity`, `iata`, `icao`.
- Aplica caché en memoria (`TTL` corto) para respuestas frecuentes.

### Ejemplo de consulta

```bash
curl -X GET "http://localhost:3000/agencias/v1/referencia-aeropuertos/sugerencias?q=bog&limit=10&country=CO" ^
  -H "Authorization: Bearer <JWT>"
```

---

## 6) Almacenaje de credenciales `maarlab_partner_credentials`

### Colección y estructura

Colección: `maarlab_partner_credentials`

Campos relevantes:

- `idSearchEngine` (único)
- `hotelName`
- `apiKey`
- `agenciaId` (nullable, referencia a `Agencia`)
- `lastSyncedAt`

### Carga/sincronización recomendada

Script: `scripts/sync-maarlab-partner-keys.ts`

Este script:

1. consulta paginado `api_keys_by_partner` en MaarLab,
2. hace `upsert` por `id_search_engine`,
3. vincula `agenciaId` cuando `hotel_name === Agencia.fullName` (match exacto).

### Variables requeridas para sync

- `MONGO_URL`
- `MAARLAB_BASE_URL`
- `MAARLAB_PARTNER_SYNC_BEARER`
- `MAARLAB_CHAIN_SEARCH_ENGINE_ID`

### Ejemplo de ejecución

```bash
npm run sync:maarlab-keys -- --size=50 --chain=UUID-DE-CADENA
```

### Cómo se resuelve la API key en runtime

En `MaarlabCredentialsService.resolveBearerForAgencia(...)`, el orden de resolución es:

1. credencial por `agenciaId`,
2. credencial por `hotelName === agencia.fullName`,
3. fallback al campo legado `Agencia.maarlabApiKey`.

Si no encuentra ninguna, lanza error de configuración.

---

## 7) Recomendaciones operativas

- Nunca guardar llaves reales en archivos versionados.
- Ejecutar `sync:maarlab-keys` periódicamente si cambian llaves en MaarLab.
- Verificar `aeropuertos_referencia/estado` después de cada seed.
- Mantener consistencia entre `Agencia.fullName` y `hotel_name` de MaarLab para mejorar el link automático de credenciales.
- Para trazabilidad, usar siempre `reservaChatbotId` al persistir vuelos en `Reserva.vuelo`.

---

## 8) Resumen corto

- La conexión a MongoDB está centralizada con `MongooseModule.forRoot`.
- Las reservas se crean con transacción (`reserva` + relación en `user.reservas`).
- Los vuelos de MaarLab se persisten como historial en `Reserva.vuelo` (array).
- El catálogo de aeropuertos se consume localmente y se alimenta por seed.
- Las credenciales de MaarLab se administran en colección dedicada y se resuelven con fallback controlado.
