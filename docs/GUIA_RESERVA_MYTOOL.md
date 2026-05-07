# Guia explicita: crear reserva en My Tool

Este documento explica de forma detallada como crear una reserva usando el endpoint principal:

- `POST /reservas/mytool/:hotelSlug`

Incluye autenticacion, estructura del body, validaciones, comportamiento interno y listado de hoteles disponibles por `hotelSlug`.

## 1) Endpoint principal

- **Metodo:** `POST`
- **Ruta:** `/reservas/mytool/:hotelSlug`
- **Auth:** JWT (`Authorization: Bearer <token>`)
- **Modulo:** `reservas`
- **Objetivo:** crear reserva en My Tool y guardar la reserva en MongoDB.

## 2) Parametro de ruta

- `hotelSlug` (obligatorio): identifica el hotel contra el cual se consumira My Tool.
- Si el slug no existe en configuracion, la peticion falla por validacion de ruta.

## 3) Flujo recomendado antes de reservar

1. Consultar mappings del hotel:
   - `GET /reservas/mytool/:hotelSlug/mappings`
2. Tomar de mappings los IDs requeridos para armar el body:
   - `categoriaId`, `ratePlan`, `segmentoId`, `subSegmentoId`, `motivoId`, etc.
3. Enviar la reserva:
   - `POST /reservas/mytool/:hotelSlug`

## 4) Campos clave del body

El body esta basado en `CreateReservaMyToolDto` y mezcla:

- Campos que **si** se envian a My Tool.
- Campos de uso interno que solo se guardan en MongoDB.

### 4.1 Campos principales requeridos

- `hotelId` (number)
- `checkIn` (string `YYYY-MM-DD`)
- `checkOut` (string `YYYY-MM-DD`)
- `bookData` (objeto)
- `rooms` (array)
- `titularInfo` (objeto interno para persistencia)
- `total` (number > 0)

### 4.2 Objeto `bookData` (resumen)

Requeridos:

- `solicitante.titular`
- `solicitante.telefono`
- `solicitante.email`
- `canalVentaId`
- `ratePlan`
- `motivoId`
- `subSegmentoId`
- `segmentoId`

Opcionales relevantes:

- `paisCode`, `monedaCode`, `comision`, `siAgregaImpto`
- `acuerdos` (este SI viaja hacia My Tool)
- `agenciaId`, `agenteId`
- `mascotasNumber` (solo interno, no se envia a My Tool)

### 4.3 Objeto `rooms[]` (resumen)

Por cada habitacion:

- `categoriaId` (requerido)
- `paxAdultos` (1-10)
- `paxChilds` (0-10)
- `dayPrice[]` (fechas/precio base)
- `guest[]` (huespedes)

Campos opcionales internos por habitacion:

- `nombreHabitacion` (solo MongoDB)
- `room_id` (solo MongoDB)

### 4.4 Campos internos (solo MongoDB, no My Tool)

- `notes`
- `mascotasNumber` (raiz)
- `mascotas`
- `infoTransporte`
- `infoToures`
- `rooms[].nombreHabitacion`
- `rooms[].room_id`
- `bookData.mascotasNumber`

## 5) Reglas importantes del backend

- `bookData.localizador` **lo genera/sobrescribe** el servidor.
- `bookData.acuerdos` se envia a My Tool.
- `notes` no se envia a My Tool (solo persistencia interna).
- Si My Tool falla y el hotel tiene `autocoreId` configurado, existe flujo de fallback a Autocore.

## 6) Ejemplo de request

```bash
curl --location --request POST 'http://localhost:3000/reservas/mytool/aixo' \
--header 'Authorization: Bearer TU_JWT' \
--header 'Content-Type: application/json' \
--data-raw '{
  "hotelId": 13633,
  "checkIn": "2026-07-10",
  "checkOut": "2026-07-12",
  "bookData": {
    "solicitante": {
      "titular": "Juan Perez",
      "telefono": "+573001234567",
      "email": "juan.perez@mail.com"
    },
    "canalVentaId": 41,
    "ratePlan": "BAR",
    "motivoId": 1,
    "subSegmentoId": 1,
    "segmentoId": 1,
    "acuerdos": "Cliente acepta terminos"
  },
  "rooms": [
    {
      "categoriaId": 10,
      "paxAdultos": 2,
      "paxChilds": 0,
      "dayPrice": [
        { "fecha": "2026-07-10", "precioBase": 250000 },
        { "fecha": "2026-07-11", "precioBase": 250000 }
      ],
      "guest": [
        {
          "documId": "12345678",
          "documTypeId": 1,
          "name": "Juan",
          "firstLastName": "Perez",
          "birthDay": "1990-01-01",
          "generId": 1,
          "phone": "+573001234567",
          "email": "juan.perez@mail.com",
          "isOwner": true
        }
      ],
      "nombreHabitacion": "Doble Superior",
      "room_id": "DBL-SUP-101"
    }
  ],
  "titularInfo": {
    "firstName": "Juan",
    "lastName": "Perez",
    "tipoDocumento": "CC",
    "documento": "12345678",
    "fechaNacimiento": "1990-01-01"
  },
  "total": 500000,
  "notes": "Solicitud de cama adicional",
  "mascotasNumber": 0
}'
```

## 7) Respuesta esperada (referencial)

La respuesta del flujo My Tool maneja esta forma general:

```json
{
  "isSuccess": true,
  "message": "Reserva creada",
  "localizador": "CB88D9393D",
  "result": {},
  "json": {}
}
```

## 8) Errores comunes

- JWT invalido o expirado.
- `hotelSlug` no configurado.
- Fechas con formato incorrecto (`YYYY-MM-DD`).
- IDs de mapping invalidos (`categoriaId`, `segmentoId`, etc.).
- Estructura incompleta en `rooms[].guest[]`.
- Timeout o error de autenticacion con API My Tool del hotel.

## 9) Listado de hoteles (`hotelSlug`)

Fuente: configuracion central `hotelMyToolConfig`.

| hotelSlug | hotel | ciudad | autocoreId |
|---|---|---|---|
| `aixo` | Hotel Aixo | Cartagena | `13633` |
| `azuan` | Hotel Azuan | Cartagena | `13645` |
| `avexi` | Hotel Avexi | Cartagena | `13644` |
| `marina` | Hotel Marina | Cartagena | `13643` |
| `bocagrande` | Hotel Bocagrande | Cartagena | `14364` |
| `abi` | Hotel Abi | Cartagena | `17644` |
| `boquilla` | Hotel Boquilla | Cartagena | `13677` |
| `madisson` | Hotel Madisson | Bogota | `16255` |
| `windsor` | Hotel Windsor | Bogota | `18004` |
| `rodadero` | Hotel Rodadero | Santa marta | `17491` |
| `axis` | Hotel Axis | Santa marta | `19629` |
| `marques` | Hotel El Marques | Cartagena | `null` |
| `sansiraka` | Hotel Sansiraka | Santa marta | `15740` |
| `playasalguero` | Playa Salguero Hotel | Santa marta | `21590` |

## 10) Endpoints complementarios My Tool

- `GET /reservas/mytool/:hotelSlug/mappings`  
  Obtiene catalogos/IDs para construir correctamente la reserva.
- `GET /reservas/mytool/:hotelSlug/buscar`  
  Busca reserva externa por `localizador` y `nombre`.
- `POST /reservas/mytool/cancelar`  
  Cancela reserva en My Tool (o Autocore segun proveedor de la reserva).
