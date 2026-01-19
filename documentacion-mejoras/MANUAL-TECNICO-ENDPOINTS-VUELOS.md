# 🛫 Manual Técnico - Endpoints de Vuelos

**Versión:** 1.0  
**Fecha:** Enero 2025  
**Base URL:** `/agencias/v1/vuelos`

---

## 📋 Tabla de Contenidos

1. [Introducción](#introducción)
2. [Autenticación](#autenticación)
3. [Endpoints de Prueba](#endpoints-de-prueba)
4. [Búsqueda de Ubicaciones](#búsqueda-de-ubicaciones)
5. [Búsqueda de Ciudades](#búsqueda-de-ciudades)
6. [Búsqueda de Aeropuertos](#búsqueda-de-aeropuertos)
7. [Búsqueda de Vuelos](#búsqueda-de-vuelos)
8. [Crear Reserva de Vuelo](#crear-reserva-de-vuelo)
9. [Consultar Reserva](#consultar-reserva)
10. [Cancelar Reserva](#cancelar-reserva)
11. [Estructuras de Datos](#estructuras-de-datos)
12. [Códigos de Error](#códigos-de-error)
13. [Ejemplos Completos](#ejemplos-completos)

---

## Introducción

Este manual técnico documenta todos los endpoints disponibles en el módulo de vuelos de la API de Agencias. Los endpoints permiten buscar ubicaciones, ciudades, aeropuertos, buscar ofertas de vuelos, crear reservas y gestionar órdenes de vuelo.

### Características Principales

- ✅ Integración con Amadeus API
- ✅ Búsqueda avanzada de vuelos
- ✅ Enriquecimiento automático con nombres de ciudades
- ✅ Manejo de errores estructurado
- ✅ Logging detallado de operaciones
- ✅ Validación completa de datos

---

## Autenticación

### JWT Bearer Token

La mayoría de los endpoints requieren autenticación mediante JWT Bearer Token.

**Header requerido:**
```
Authorization: Bearer {token}
```

**Nota:** Los endpoints de prueba y búsqueda de ubicaciones pueden no requerir autenticación dependiendo de la configuración.

---

## Endpoints de Prueba

### 1. Verificar Estado del Módulo

**Endpoint:** `GET /vuelos/test`

**Descripción:** Verifica que el módulo de vuelos esté funcionando correctamente.

**Autenticación:** No requerida

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "El módulo de vuelos está funcionando correctamente",
  "status": "OK"
}
```

**Ejemplo de Uso:**
```bash
curl -X GET http://localhost:3000/agencias/v1/vuelos/test
```

---

### 2. Probar Autenticación con Amadeus

**Endpoint:** `GET /vuelos/test-auth`

**Descripción:** Prueba la autenticación con la API de Amadeus y verifica que las credenciales funcionen correctamente.

**Autenticación:** No requerida

**Respuesta Exitosa (200 OK):**
```json
{
  "message": "Autenticación con Amadeus exitosa",
  "status": "OK",
  "tokenInfo": {
    "tokenLength": 1234,
    "tokenPreview": "eyJhbGciOi...",
    "timestamp": "2025-01-14T10:30:00.000Z"
  }
}
```

**Respuesta de Error:**
```json
{
  "statusCode": 500,
  "message": "Error en autenticación con Amadeus",
  "error": "Internal Server Error"
}
```

**Ejemplo de Uso:**
```bash
curl -X GET http://localhost:3000/agencias/v1/vuelos/test-auth
```

---

## Búsqueda de Ubicaciones

### 3. Buscar Ubicaciones (Aeropuertos y Ciudades)

**Endpoint:** `GET /vuelos/ubicaciones`

**Descripción:** Busca aeropuertos y ciudades por palabra clave. Retorna resultados ordenados por relevancia.

**Autenticación:** No requerida (dependiendo de configuración)

**Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción | Valor por Defecto |
|-----------|------|-----------|-------------|-------------------|
| `keyword` | string | ✅ Sí | Palabra clave para buscar (código IATA, nombre de ciudad o aeropuerto) | - |
| `subType` | string | ❌ No | Tipo de ubicación: `AIRPORT`, `CITY` o `AIRPORT,CITY` | `AIRPORT,CITY` |
| `countryCode` | string | ❌ No | Código de país ISO (ej: `CO`, `US`) | - |
| `page[limit]` | number | ❌ No | Número máximo de resultados (1-100) | `10` |
| `page[offset]` | number | ❌ No | Offset para paginación (≥0) | `0` |
| `sort` | string | ❌ No | Ordenamiento (solo `analytics.travelers.score`) | `analytics.travelers.score` |
| `view` | string | ❌ No | Vista: `LIGHT` o `FULL` | `FULL` |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:3000/agencias/v1/vuelos/ubicaciones?keyword=BOG&subType=AIRPORT&page[limit]=5"
```

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "type": "location",
      "subType": "AIRPORT",
      "name": "El Dorado International Airport",
      "detailedName": "Bogotá / El Dorado",
      "id": "BOG",
      "self": {
        "href": "https://test.api.amadeus.com/v1/reference-data/locations/BOG",
        "methods": ["GET"]
      },
      "timeZoneOffset": "-05:00",
      "iataCode": "BOG",
      "geoCode": {
        "latitude": 4.70159,
        "longitude": -74.1469
      },
      "address": {
        "cityName": "Bogotá",
        "cityCode": "BOG",
        "countryName": "Colombia",
        "countryCode": "CO",
        "regionCode": "CO-DC"
      },
      "analytics": {
        "travelers": {
          "score": 100
        }
      }
    }
  ],
  "meta": {
    "count": 1,
    "links": {
      "self": "https://test.api.amadeus.com/v1/reference-data/locations?subType=AIRPORT&keyword=BOG"
    }
  }
}
```

**Códigos de Error:**
- `400`: Parámetros inválidos
- `500`: Error interno del servidor

---

## Búsqueda de Ciudades

### 4. Buscar Ciudades por Nombre

**Endpoint:** `GET /vuelos/ciudades`

**Descripción:** Busca ciudades por nombre. Versión simplificada del endpoint de ubicaciones.

**Autenticación:** No requerida

**Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `nombre` | string | ✅ Sí | Nombre de la ciudad a buscar |
| `countryCode` | string | ❌ No | Código de país ISO (ej: `CO`, `US`) |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:3000/agencias/v1/vuelos/ciudades?nombre=Bogotá&countryCode=CO"
```

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "type": "location",
      "subType": "CITY",
      "name": "Bogotá",
      "detailedName": "Bogotá",
      "id": "BOG",
      "self": {
        "href": "https://test.api.amadeus.com/v1/reference-data/locations/BOG",
        "methods": ["GET"]
      },
      "iataCode": "BOG",
      "geoCode": {
        "latitude": 4.60971,
        "longitude": -74.08175
      },
      "address": {
        "cityName": "Bogotá",
        "cityCode": "BOG",
        "countryName": "Colombia",
        "countryCode": "CO"
      }
    }
  ],
  "meta": {
    "count": 1
  }
}
```

---

### 5. Buscar Ciudades (Avanzado)

**Endpoint:** `GET /vuelos/ciudades/buscar`

**Descripción:** Búsqueda avanzada de ciudades con más opciones de filtrado.

**Autenticación:** No requerida

**Query Parameters:**

| Parámetro | Tipo | Requerido | Descripción | Valor por Defecto |
|-----------|------|-----------|-------------|-------------------|
| `keyword` | string | ✅ Sí | Palabra clave para buscar | - |
| `countryCode` | string | ❌ No | Código de país ISO (se convierte a mayúsculas) | - |
| `max` | number | ❌ No | Número máximo de resultados (1-100) | `10` |
| `include` | string[] | ❌ No | Tipos a incluir: `AIRPORTS`, `AIRPORT_CITIES`, etc. (separados por coma) | `["AIRPORTS"]` |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:3000/agencias/v1/vuelos/ciudades/buscar?keyword=Medellin&countryCode=CO&max=5&include=AIRPORTS"
```

**Respuesta:** Similar a la respuesta del endpoint anterior.

---

## Búsqueda de Aeropuertos

### 6. Buscar Aeropuerto por Código IATA

**Endpoint:** `GET /vuelos/aeropuertos/iata/:iataCode`

**Descripción:** Busca un aeropuerto específico por su código IATA.

**Autenticación:** No requerida

**Path Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `iataCode` | string | ✅ Sí | Código IATA del aeropuerto (ej: `BOG`, `MDE`, `JFK`) |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:3000/agencias/v1/vuelos/aeropuertos/iata/BOG"
```

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "type": "location",
      "subType": "AIRPORT",
      "name": "El Dorado International Airport",
      "detailedName": "Bogotá / El Dorado",
      "id": "BOG",
      "iataCode": "BOG",
      "geoCode": {
        "latitude": 4.70159,
        "longitude": -74.1469
      },
      "address": {
        "cityName": "Bogotá",
        "cityCode": "BOG",
        "countryName": "Colombia",
        "countryCode": "CO"
      }
    }
  ],
  "meta": {
    "count": 1
  }
}
```

**Códigos de Error:**
- `404`: Aeropuerto no encontrado
- `500`: Error interno del servidor

---

## Búsqueda de Vuelos

### 7. Buscar Ofertas de Vuelos

**Endpoint:** `POST /vuelos/disponibilidad`

**Descripción:** Busca ofertas de vuelos disponibles según los criterios especificados. Las respuestas incluyen nombres de ciudades enriquecidos automáticamente.

**Autenticación:** Recomendada (dependiendo de configuración)

**Content-Type:** `application/json`

**Request Body:**

```typescript
{
  currencyCode?: string;                    // Código de moneda (ej: "USD", "COP") - Default: "USD"
  originDestinations: [                     // Array de 1-6 rutas
    {
      id: string;                           // ID único para esta ruta (ej: "1")
      originLocationCode: string;           // Código IATA origen (ej: "BOG")
      destinationLocationCode: string;      // Código IATA destino (ej: "MDE")
      departureDate: string;                // Fecha en formato ISO (YYYY-MM-DD)
      departureTime?: string;              // Hora opcional (HH:mm:ss) - Default: "00:00:00"
    }
  ],
  travelers: [                              // Array de 1-9 viajeros
    {
      id: string;                           // ID único del viajero (ej: "1")
      travelerType: "ADULT" | "CHILD" | "SENIOR" | "YOUNG" | "DISABLED" | 
                    "DISABLED_CHILD" | "ESCORT" | "LARGE_FAMILY" | "STUDENT"
    }
  ],
  sources?: string[];                       // Fuentes de datos - Default: ["GDS"]
  searchCriteria?: {
    maxFlightOffers?: number;              // Máximo de ofertas (1-250) - Default: 50
    flightFilters?: {
      cabinRestrictions?: [                 // Restricciones de cabina
        {
          cabin: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
          coverage: "MOST_SEGMENTS" | "AT_LEAST_ONE_SEGMENT" | "ALL_SEGMENTS";
          originDestinationIds: string[];   // IDs de rutas afectadas
        }
      ],
      excludedCarrierCodes?: string[];    // Códigos de aerolíneas a excluir
      includedCarrierCodes?: string[];    // Códigos de aerolíneas a incluir
      maxPrice?: number;                   // Precio máximo
      minPrice?: number;                   // Precio mínimo
      earliestDepartureTime?: string;      // Hora más temprana (HH:mm:ss)
      latestDepartureTime?: string;        // Hora más tardía (HH:mm:ss)
      maxNumberOfConnections?: number;     // Máximo de conexiones
    }
  }
}
```

**Ejemplo de Request:**
```json
{
  "currencyCode": "USD",
  "originDestinations": [
    {
      "id": "1",
      "originLocationCode": "BOG",
      "destinationLocationCode": "MDE",
      "departureDate": "2025-02-15",
      "departureTime": "08:00:00"
    }
  ],
  "travelers": [
    {
      "id": "1",
      "travelerType": "ADULT"
    }
  ],
  "sources": ["GDS"],
  "searchCriteria": {
    "maxFlightOffers": 10,
    "flightFilters": {
      "cabinRestrictions": [
        {
          "cabin": "ECONOMY",
          "coverage": "ALL_SEGMENTS",
          "originDestinationIds": ["1"]
        }
      ],
      "maxPrice": 500
    }
  }
}
```

**Ejemplo de Uso:**
```bash
curl -X POST http://localhost:3000/agencias/v1/vuelos/disponibilidad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "currencyCode": "USD",
    "originDestinations": [
      {
        "id": "1",
        "originLocationCode": "BOG",
        "destinationLocationCode": "MDE",
        "departureDate": "2025-02-15"
      }
    ],
    "travelers": [
      {
        "id": "1",
        "travelerType": "ADULT"
      }
    ]
  }'
```

**Respuesta Exitosa (200 OK):**
```json
{
  "data": [
    {
      "type": "flight-offer",
      "id": "1",
      "source": "GDS",
      "instantTicketingRequired": false,
      "nonHomogeneous": false,
      "oneWay": false,
      "lastTicketingDate": "2025-02-10",
      "numberOfBookableSeats": 9,
      "itineraries": [
        {
          "duration": "PT1H10M",
          "segments": [
            {
              "departure": {
                "iataCode": "BOG",
                "cityName": "Bogotá",        // ✅ Enriquecido automáticamente
                "terminal": "1",
                "at": "2025-02-15T08:00:00"
              },
              "arrival": {
                "iataCode": "MDE",
                "cityName": "Medellín",       // ✅ Enriquecido automáticamente
                "at": "2025-02-15T09:10:00"
              },
              "carrierCode": "AV",
              "number": "8420",
              "aircraft": {
                "code": "320"
              },
              "duration": "PT1H10M",
              "id": "1",
              "numberOfStops": 0,
              "blacklistedInEU": false
            }
          ]
        }
      ],
      "pricingOptions": {
        "fareType": ["PUBLISHED"],
        "includedCheckedBagsOnly": true
      },
      "validatingAirlineCodes": ["AV"],
      "travelerPricings": [
        {
          "travelerId": "1",
          "fareOption": "STANDARD",
          "travelerType": "ADULT",
          "price": {
            "currency": "USD",
            "total": "150.00",
            "base": "120.00",
            "fees": [
              {
                "amount": "30.00",
                "type": "SUPPLIER"
              }
            ]
          },
          "fareDetailsBySegment": [
            {
              "segmentId": "1",
              "cabin": "ECONOMY",
              "fareBasis": "Y",
              "class": "Y",
              "includedCheckedBags": {
                "quantity": 1
              }
            }
          ]
        }
      ]
    }
  ],
  "meta": {
    "count": 1,
    "links": {
      "self": "https://test.api.amadeus.com/v2/shopping/flight-offers"
    }
  }
}
```

**Características Especiales:**
- ✅ **Enriquecimiento automático:** Los códigos IATA se enriquecen con nombres de ciudades
- ✅ **Validación completa:** Todos los campos son validados antes de enviar a Amadeus
- ✅ **Logging detallado:** Cada búsqueda se registra con contexto completo

**Códigos de Error:**
- `400`: Datos de búsqueda inválidos
- `401`: No autenticado
- `500`: Error interno del servidor o error de Amadeus

---

### 8. Buscar Ofertas de Vuelos (Endpoint de Prueba)

**Endpoint:** `POST /vuelos/disponibilidad-test`

**Descripción:** Endpoint de prueba para depurar problemas de disponibilidad. Acepta un body más flexible.

**Autenticación:** No requerida

**Nota:** Este endpoint está diseñado para desarrollo y debugging. No debe usarse en producción.

---

## Crear Reserva de Vuelo

### 9. Crear Reserva (Flight Order)

**Endpoint:** `POST /vuelos/reservar`

**Descripción:** Crea una reserva de vuelo (flight order) con los datos de los viajeros y la oferta seleccionada.

**Autenticación:** Requerida

**Content-Type:** `application/json`

**Request Body:**

```typescript
{
  flightOffers: [                           // Array de ofertas de vuelo (mínimo 1)
    {
      type?: "flight-offer";                // Default: "flight-offer"
      id: string;                           // ID de la oferta de vuelo
      source?: string;                      // Default: "GDS"
      instantTicketingRequired?: boolean;  // Default: false
      nonHomogeneous?: boolean;            // Default: false
      paymentCardRequired?: boolean;        // Default: false
      lastTicketingDate?: string;          // Fecha límite de emisión
      itineraries: [
        {
          segments: [
            {
              departure: {
                iataCode: string;
                terminal?: string;
                at: string;                 // Fecha y hora ISO
              };
              arrival: {
                iataCode: string;
                terminal?: string;
                at: string;                 // Fecha y hora ISO
              };
              carrierCode: string;
              number: string;
              aircraft: {
                code: string;
              };
              operating?: {
                carrierCode?: string;
                carrierName?: string;
              };
              duration: string;            // Formato ISO 8601 (ej: "PT1H10M")
              id: string;
              numberOfStops: number;
            }
          ]
        }
      ],
      price: {
        currency: string;
        total: string;
        base: string;
        fees: [
          {
            amount: string;
            type: string;
          }
        ];
        grandTotal: string;
        billingCurrency?: string;
        additionalServices?: [
          {
            amount: string;
            type: string;
          }
        ];
      },
      pricingOptions?: {
        fareType: string[];
        includedCheckedBagsOnly: boolean;
      };
      validatingAirlineCodes?: string[];
      travelerPricings?: [
        {
          travelerId: string;
          fareOption: string;
          travelerType: "ADULT" | "CHILD" | "INFANT";
          price: {
            currency: string;
            total: string;
            base: string;
            fees?: [
              {
                amount: string;
                type: string;
              }
            ];
            grandTotal?: string;
            taxes?: [
              {
                amount: string;
                code: string;
              }
            ];
          };
          fareDetailsBySegment: [
            {
              segmentId: string;
              cabin: string;
              fareBasis: string;
              brandedFare?: string;
              brandedFareLabel?: string;
              class: string;
              includedCheckedBags: {
                quantity: number;
              };
              includedCabinBags?: {
                quantity: number;
              };
            }
          ];
        }
      ];
    }
  ],
  travelers: [                              // Array de viajeros (mínimo 1)
    {
      id: string;                           // ID del viajero (debe coincidir con travelerPricings)
      dateOfBirth: string;                  // Fecha en formato ISO (YYYY-MM-DD)
      name: {
        firstName: string;
        lastName: string;
      };
      gender: "MALE" | "FEMALE";
      contact: {
        emailAddress: string;
        phones: [
          {
            deviceType: "MOBILE" | "LANDLINE";
            countryCallingCode: string;    // Ej: "+57"
            number: string;
          }
        ];
      };
      documents?: [                         // Opcional pero recomendado
        {
          documentType: "PASSPORT" | "ID_CARD";
          number: string;
          expiryDate?: string;              // Fecha en formato ISO
          issuanceCountry?: string;         // Código ISO del país
          nationality?: string;             // Código ISO del país
          holder: boolean;                 // true si es el titular
        }
      ];
    }
  ],
  remarks?: {                               // Opcional
    general?: [
      {
        subType: string;
        text: string;
      }
    ];
  },
  ticketingAgreement?: {                    // Opcional
    option: "DELAY_TO_CANCEL";
    delay: string;                          // Duración en formato ISO 8601
  },
  contacts?: [                              // Opcional
    {
      addresseeName: {
        firstName: string;
        lastName: string;
      };
      companyName?: string;
      purpose: "STANDARD" | "LEISURE" | "BUSINESS";
      phones: [
        {
          deviceType: "MOBILE" | "LANDLINE";
          countryCallingCode: string;
          number: string;
        }
      ];
      emailAddress: string;
      address: {
        lines: string[];                    // Array de líneas de dirección
        postalCode: string;
        cityName: string;
        countryCode: string;                // Código ISO del país
      };
    }
  ];
}
```

**Ejemplo de Request:**
```json
{
  "flightOffers": [
    {
      "type": "flight-offer",
      "id": "1",
      "source": "GDS",
      "instantTicketingRequired": false,
      "nonHomogeneous": false,
      "itineraries": [
        {
          "segments": [
            {
              "departure": {
                "iataCode": "BOG",
                "terminal": "1",
                "at": "2025-02-15T08:00:00"
              },
              "arrival": {
                "iataCode": "MDE",
                "at": "2025-02-15T09:10:00"
              },
              "carrierCode": "AV",
              "number": "8420",
              "aircraft": {
                "code": "320"
              },
              "duration": "PT1H10M",
              "id": "1",
              "numberOfStops": 0
            }
          ]
        }
      ],
      "price": {
        "currency": "USD",
        "total": "150.00",
        "base": "120.00",
        "fees": [
          {
            "amount": "30.00",
            "type": "SUPPLIER"
          }
        ],
        "grandTotal": "150.00"
      },
      "travelerPricings": [
        {
          "travelerId": "1",
          "fareOption": "STANDARD",
          "travelerType": "ADULT",
          "price": {
            "currency": "USD",
            "total": "150.00",
            "base": "120.00"
          },
          "fareDetailsBySegment": [
            {
              "segmentId": "1",
              "cabin": "ECONOMY",
              "fareBasis": "Y",
              "class": "Y",
              "includedCheckedBags": {
                "quantity": 1
              }
            }
          ]
        }
      ]
    }
  ],
  "travelers": [
    {
      "id": "1",
      "dateOfBirth": "1990-01-15",
      "name": {
        "firstName": "Juan",
        "lastName": "Pérez"
      },
      "gender": "MALE",
      "contact": {
        "emailAddress": "juan.perez@example.com",
        "phones": [
          {
            "deviceType": "MOBILE",
            "countryCallingCode": "+57",
            "number": "3001234567"
          }
        ]
      },
      "documents": [
        {
          "documentType": "PASSPORT",
          "number": "AB123456",
          "expiryDate": "2030-01-15",
          "issuanceCountry": "CO",
          "nationality": "CO",
          "holder": true
        }
      ]
    }
  ],
  "contacts": [
    {
      "addresseeName": {
        "firstName": "Juan",
        "lastName": "Pérez"
      },
      "purpose": "STANDARD",
      "phones": [
        {
          "deviceType": "MOBILE",
          "countryCallingCode": "+57",
          "number": "3001234567"
        }
      ],
      "emailAddress": "juan.perez@example.com",
      "address": {
        "lines": ["Calle 123 #45-67"],
        "postalCode": "110111",
        "cityName": "Bogotá",
        "countryCode": "CO"
      }
    }
  ]
}
```

**Ejemplo de Uso:**
```bash
curl -X POST http://localhost:3000/agencias/v1/vuelos/reservar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d @flight-order.json
```

**Respuesta Exitosa (201 Created):**
```json
{
  "data": {
    "type": "flight-order",
    "id": "eJzTd9f3NjIwMDTXd9c3MjAw0A8EAA%3D%3D",
    "flightOffers": [
      {
        "type": "flight-offer",
        "id": "1",
        "source": "GDS",
        "instantTicketingRequired": false,
        "itineraries": [
          {
            "segments": [
              {
                "departure": {
                  "iataCode": "BOG",
                  "terminal": "1",
                  "at": "2025-02-15T08:00:00"
                },
                "arrival": {
                  "iataCode": "MDE",
                  "at": "2025-02-15T09:10:00"
                },
                "carrierCode": "AV",
                "number": "8420",
                "aircraft": {
                  "code": "320"
                },
                "duration": "PT1H10M",
                "id": "1",
                "numberOfStops": 0
              }
            ]
          }
        ],
        "price": {
          "currency": "USD",
          "total": "150.00",
          "base": "120.00",
          "fees": [
            {
              "amount": "30.00",
              "type": "SUPPLIER"
            }
          ],
          "grandTotal": "150.00"
        }
      }
    ],
    "travelers": [
      {
        "id": "1",
        "dateOfBirth": "1990-01-15",
        "name": {
          "firstName": "Juan",
          "lastName": "Pérez"
        },
        "gender": "MALE",
        "contact": {
          "emailAddress": "juan.perez@example.com",
          "phones": [
            {
              "deviceType": "MOBILE",
              "countryCallingCode": "+57",
              "number": "3001234567"
            }
          ]
        }
      }
    ],
    "contacts": [
      {
        "addresseeName": {
          "firstName": "Juan",
          "lastName": "Pérez"
        },
        "purpose": "STANDARD",
        "phones": [
          {
            "deviceType": "MOBILE",
            "countryCallingCode": "+57",
            "number": "3001234567"
          }
        ],
        "emailAddress": "juan.perez@example.com",
        "address": {
          "lines": ["Calle 123 #45-67"],
          "postalCode": "110111",
          "cityName": "Bogotá",
          "countryCode": "CO"
        }
      }
    ],
    "associatedRecords": [
      {
        "reference": "PNR123456",
        "creationDate": "2025-01-14T10:30:00",
        "originSystemCode": "GDS",
        "flightOfferId": "1"
      }
    ],
    "ticketingAgreement": {
      "option": "DELAY_TO_CANCEL",
      "delay": "PT24H"
    },
    "automatedProcess": [
      {
        "code": "TICKETING",
        "queue": {
          "number": 1,
          "category": "STANDARD"
        }
      }
    ]
  },
  "meta": {
    "count": 1,
    "links": {
      "self": "https://test.api.amadeus.com/v1/booking/flight-orders/eJzTd9f3NjIwMDTXd9c3MjAw0A8EAA%3D%3D"
    }
  }
}
```

**Códigos de Error:**
- `400`: Datos de reserva inválidos
- `401`: No autenticado
- `422`: Error de validación de Amadeus
- `500`: Error interno del servidor

---

## Consultar Reserva

### 10. Consultar Reserva por ID

**Endpoint:** `GET /vuelos/reservas/:flightOrderId`

**Descripción:** Consulta los detalles de una reserva de vuelo específica por su ID.

**Autenticación:** Requerida

**Path Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `flightOrderId` | string | ✅ Sí | ID de la reserva de vuelo (retornado al crear la reserva) |

**Ejemplo de Request:**
```bash
curl -X GET "http://localhost:3000/agencias/v1/vuelos/reservas/eJzTd9f3NjIwMDTXd9c3MjAw0A8EAA%3D%3D" \
  -H "Authorization: Bearer {token}"
```

**Respuesta Exitosa (200 OK):**
```json
{
  "data": {
    "type": "flight-order",
    "id": "eJzTd9f3NjIwMDTXd9c3MjAw0A8EAA%3D%3D",
    "flightOffers": [...],
    "travelers": [...],
    "contacts": [...],
    "associatedRecords": [...],
    "ticketingAgreement": {...},
    "automatedProcess": [...]
  },
  "meta": {
    "count": 1,
    "links": {
      "self": "https://test.api.amadeus.com/v1/booking/flight-orders/..."
    }
  }
}
```

**Códigos de Error:**
- `401`: No autenticado
- `404`: Reserva no encontrada
- `500`: Error interno del servidor

---

## Cancelar Reserva

### 11. Cancelar Reserva

**Endpoint:** `DELETE /vuelos/reservas/:flightOrderId`

**Descripción:** Cancela una reserva de vuelo específica.

**Autenticación:** Requerida

**Path Parameters:**

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `flightOrderId` | string | ✅ Sí | ID de la reserva de vuelo a cancelar |

**Ejemplo de Request:**
```bash
curl -X DELETE "http://localhost:3000/agencias/v1/vuelos/reservas/eJzTd9f3NjIwMDTXd9c3MjAw0A8EAA%3D%3D" \
  -H "Authorization: Bearer {token}"
```

**Respuesta Exitosa (204 No Content):**
- Sin cuerpo de respuesta

**Códigos de Error:**
- `401`: No autenticado
- `404`: Reserva no encontrada
- `422`: No se puede cancelar (ya cancelada, fuera de tiempo, etc.)
- `500`: Error interno del servidor

---

## Estructuras de Datos

### Tipos de Viajeros

| Tipo | Descripción |
|------|-------------|
| `ADULT` | Adulto (mayor de 12 años) |
| `CHILD` | Niño (2-11 años) |
| `SENIOR` | Adulto mayor |
| `YOUNG` | Joven (12-17 años) |
| `DISABLED` | Persona con discapacidad |
| `DISABLED_CHILD` | Niño con discapacidad |
| `ESCORT` | Acompañante |
| `LARGE_FAMILY` | Familia numerosa |
| `STUDENT` | Estudiante |

### Clases de Cabina

| Clase | Descripción |
|-------|-------------|
| `ECONOMY` | Clase económica |
| `PREMIUM_ECONOMY` | Clase económica premium |
| `BUSINESS` | Clase ejecutiva |
| `FIRST` | Primera clase |

### Tipos de Documento

| Tipo | Descripción |
|------|-------------|
| `PASSPORT` | Pasaporte |
| `ID_CARD` | Cédula de identidad |

### Propósitos de Contacto

| Propósito | Descripción |
|-----------|-------------|
| `STANDARD` | Estándar |
| `LEISURE` | Ocio |
| `BUSINESS` | Negocios |

---

## Códigos de Error

### Códigos HTTP Comunes

| Código | Descripción | Solución |
|--------|-------------|----------|
| `200` | OK | Operación exitosa |
| `201` | Created | Recurso creado exitosamente |
| `204` | No Content | Operación exitosa sin contenido |
| `400` | Bad Request | Datos de entrada inválidos |
| `401` | Unauthorized | Token de autenticación inválido o faltante |
| `404` | Not Found | Recurso no encontrado |
| `422` | Unprocessable Entity | Error de validación de Amadeus |
| `429` | Too Many Requests | Límite de rate limiting excedido |
| `500` | Internal Server Error | Error interno del servidor |
| `502` | Bad Gateway | Error de comunicación con Amadeus |
| `503` | Service Unavailable | Servicio temporalmente no disponible |

### Estructura de Error

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request",
  "errors": [
    {
      "status": 400,
      "code": 477,
      "title": "INVALID FORMAT",
      "detail": "The format of the departure date is invalid",
      "source": {
        "parameter": "originDestinations[0].departureDate",
        "example": "2025-02-15"
      }
    }
  ]
}
```

---

## Ejemplos Completos

### Flujo Completo: Búsqueda y Reserva

#### Paso 1: Buscar Ubicaciones

```bash
# Buscar aeropuerto de origen
curl -X GET "http://localhost:3000/agencias/v1/vuelos/ubicaciones?keyword=BOG&subType=AIRPORT"

# Buscar aeropuerto de destino
curl -X GET "http://localhost:3000/agencias/v1/vuelos/ubicaciones?keyword=MDE&subType=AIRPORT"
```

#### Paso 2: Buscar Vuelos

```bash
curl -X POST http://localhost:3000/agencias/v1/vuelos/disponibilidad \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "currencyCode": "USD",
    "originDestinations": [
      {
        "id": "1",
        "originLocationCode": "BOG",
        "destinationLocationCode": "MDE",
        "departureDate": "2025-02-15"
      }
    ],
    "travelers": [
      {
        "id": "1",
        "travelerType": "ADULT"
      }
    ],
    "searchCriteria": {
      "maxFlightOffers": 10
    }
  }'
```

#### Paso 3: Crear Reserva

```bash
curl -X POST http://localhost:3000/agencias/v1/vuelos/reservar \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "flightOffers": [/* oferta seleccionada del paso 2 */],
    "travelers": [/* datos de viajeros */],
    "contacts": [/* información de contacto */]
  }'
```

#### Paso 4: Consultar Reserva

```bash
curl -X GET "http://localhost:3000/agencias/v1/vuelos/reservas/{flightOrderId}" \
  -H "Authorization: Bearer {token}"
```

#### Paso 5: Cancelar Reserva (si es necesario)

```bash
curl -X DELETE "http://localhost:3000/agencias/v1/vuelos/reservas/{flightOrderId}" \
  -H "Authorization: Bearer {token}"
```

---

## Mejores Prácticas

### 1. Búsqueda de Vuelos

- ✅ **Usar códigos IATA:** Siempre usar códigos IATA de 3 letras para aeropuertos
- ✅ **Validar fechas:** Asegurar que las fechas sean futuras y en formato correcto
- ✅ **Limitar resultados:** Usar `maxFlightOffers` para evitar respuestas muy grandes
- ✅ **Filtros apropiados:** Usar filtros de precio y cabina cuando sea necesario

### 2. Creación de Reservas

- ✅ **Datos completos:** Incluir todos los datos requeridos de viajeros
- ✅ **Documentos válidos:** Incluir documentos cuando sea posible
- ✅ **Contactos:** Siempre incluir información de contacto
- ✅ **Validar ofertas:** Asegurar que la oferta de vuelo no haya expirado

### 3. Manejo de Errores

- ✅ **Revisar códigos:** Siempre verificar el código de estado HTTP
- ✅ **Leer mensajes:** Los mensajes de error contienen información útil
- ✅ **Reintentar:** Implementar lógica de reintento para errores temporales
- ✅ **Logging:** Registrar errores para debugging

### 4. Performance

- ✅ **Cachear ubicaciones:** Cachear resultados de búsqueda de ubicaciones
- ✅ **Paginación:** Usar paginación cuando sea posible
- ✅ **Timeouts:** Configurar timeouts apropiados para requests
- ✅ **Rate Limiting:** Respetar los límites de rate limiting

---

## Notas Importantes

### Enriquecimiento Automático

El endpoint de búsqueda de vuelos (`/disponibilidad`) enriquece automáticamente las respuestas con nombres de ciudades. Los códigos IATA se complementan con el nombre completo de la ciudad, mejorando la experiencia del usuario.

### Validación de Datos

Todos los endpoints validan exhaustivamente los datos de entrada usando DTOs con class-validator. Los errores de validación se retornan con información detallada sobre qué campos son inválidos.

### Logging

Todos los endpoints registran operaciones con contexto completo, incluyendo:
- Request ID único
- Parámetros de búsqueda
- Resultados encontrados
- Errores y excepciones

### Manejo de Errores

El módulo de vuelos implementa un sistema robusto de manejo de errores con:
- Interceptores para capturar errores
- Filtros para formatear respuestas de error
- Servicios especializados para procesar errores de Amadeus

---

## Referencias

- **Documentación Amadeus:** [Amadeus API Documentation](https://developers.amadeus.com/)
- **Códigos IATA:** [IATA Codes](https://www.iata.org/en/publications/directories/code-search/)
- **Documentación de la API:** `/agencias/v1/api-docs` (Swagger)

---

## Soporte

Para problemas o preguntas sobre los endpoints de vuelos:
1. Revisar los logs del servidor
2. Verificar la documentación de Swagger
3. Contactar al equipo de desarrollo

---

**Última Actualización:** Enero 2025  
**Versión del Manual:** 1.0  
**Estado:** ✅ Completo
