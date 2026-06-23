# Sistema de Manejo de Errores Mejorado - Módulo de Vuelos

## Descripción General

Se ha implementado un sistema de manejo de errores centralizado y mejorado para todos los endpoints del módulo de vuelos conectados a Amadeus. Este sistema proporciona logging detallado, diferenciación clara entre errores de Amadeus y errores internos, y respuestas de error estandarizadas y profesionales.

## Características Principales

### 1. Diferenciación de Errores
- **Errores de Amadeus**: Errores provenientes de la API de Amadeus (autenticación, límites de velocidad, validación de datos, etc.)
- **Errores Internos**: Errores del sistema interno (validación, lógica de negocio, etc.)
- **Errores de Red**: Timeouts, problemas de conectividad
- **Errores de Validación**: Errores en los datos de entrada

### 2. Logging Detallado
- **Request ID único** para cada solicitud para facilitar el tracking
- **Logs estructurados** con información contextual
- **Diferentes niveles de log** (ERROR, WARN, INFO, DEBUG)
- **Métricas de rendimiento** (duración de operaciones)

### 3. Respuestas de Error Estandarizadas
- **Formato consistente** para todas las respuestas de error
- **Códigos de error específicos** para cada tipo de problema
- **Mensajes profesionales** sin emojis
- **Detalles técnicos** para debugging

## Estructura del Sistema

### Archivos Principales

```
src/vuelos/
├── interfaces/
│   └── error-response.interface.ts    # Interfaces para errores
├── dto/
│   └── error-response.dto.ts          # DTOs para respuestas de error
├── services/
│   └── error-handler.service.ts       # Servicio centralizado de manejo de errores
├── interceptors/
│   └── error-handler.interceptor.ts   # Interceptor para capturar errores
├── filters/
│   └── error-handler.filter.ts        # Filtro global de excepciones
└── ERROR_HANDLING_SYSTEM.md           # Esta documentación
```

### Componentes del Sistema

#### 1. ErrorHandlerService
Servicio centralizado que maneja todos los tipos de errores:

- `handleAmadeusError()` - Errores de la API de Amadeus
- `handleInternalError()` - Errores internos del sistema
- `handleValidationError()` - Errores de validación
- `handleNetworkError()` - Errores de red

#### 2. ErrorHandlerInterceptor
Interceptor que captura errores y agrega contexto de logging:

- Genera Request ID único
- Captura información del request
- Mide duración de operaciones
- Proporciona contexto para logging

#### 3. ErrorHandlerFilter
Filtro global que procesa todas las excepciones:

- Convierte excepciones a respuestas estandarizadas
- Aplica formato consistente
- Maneja errores no capturados
- Proporciona logging final

## Tipos de Errores

### Errores de Amadeus

```typescript
{
  "success": false,
  "error": {
    "code": "AMADEUS_AUTHENTICATION_FAILED",
    "message": "Error de autenticación con Amadeus",
    "details": "Credenciales inválidas o token expirado",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_123456789",
    "source": "amadeus",
    "statusCode": 401
  },
  "data": {
    "amadeusErrors": [...],
    "endpoint": "/v2/shopping/flight-offers",
    "method": "POST"
  }
}
```
l
### Errores Internos

```typescript
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Error interno del servidor",
    "details": "Error: TypeError - Cannot read property 'id' of undefined",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_123456789",
    "source": "internal",
    "statusCode": 500
  },
  "data": {
    "service": "VuelosService",
    "method": "searchFlightOffers",
    "originalError": {
      "name": "TypeError",
      "message": "Cannot read property 'id' of undefined"
    }
  }
}
```

### Errores de Validación

```typescript
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error de validación en los datos de entrada",
    "details": "El campo 'originLocationCode' es requerido",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_123456789",
    "source": "validation",
    "statusCode": 400
  },
  "data": {
    "field": "originLocationCode",
    "value": null,
    "constraint": "isNotEmpty",
    "message": "El campo 'originLocationCode' es requerido"
  }
}
```

## Códigos de Error

### Errores de Amadeus
- `AMADEUS_AUTHENTICATION_FAILED` - Error de autenticación
- `AMADEUS_FORBIDDEN` - Acceso denegado
- `AMADEUS_NOT_FOUND` - Recurso no encontrado
- `AMADEUS_BAD_REQUEST` - Solicitud inválida
- `AMADEUS_VALIDATION_ERROR` - Error de validación
- `AMADEUS_RATE_LIMIT_EXCEEDED` - Límite de velocidad excedido
- `AMADEUS_SERVER_ERROR` - Error del servidor de Amadeus

### Errores Internos
- `INTERNAL_SERVER_ERROR` - Error interno general
- `VALIDATION_ERROR` - Error de validación
- `TYPE_ERROR` - Error de tipo de datos
- `REFERENCE_ERROR` - Error de referencia
- `SYNTAX_ERROR` - Error de sintaxis
- `TIMEOUT_ERROR` - Timeout en operación
- `CONNECTION_ERROR` - Error de conexión

### Errores de Red
- `NETWORK_TIMEOUT` - Timeout de red
- `NETWORK_ERROR` - Error de conexión de red

## Logging

### Estructura de Logs

Los logs siguen un formato estructurado con prefijos para facilitar el filtrado:

- `[AMADEUS_REQUEST]` - Inicio de solicitud a Amadeus
- `[AMADEUS_SUCCESS]` - Solicitud exitosa a Amadeus
- `[AMADEUS_ERROR]` - Error en solicitud a Amadeus
- `[AMADEUS_RETRY]` - Reintento de solicitud a Amadeus
- `[FLIGHT_SEARCH]` - Búsqueda de vuelos
- `[FLIGHT_ORDER]` - Creación de reservas
- `[CONTROLLER]` - Operaciones del controlador
- `[INTERNAL_ERROR]` - Errores internos
- `[VALIDATION_ERROR]` - Errores de validación
- `[NETWORK_ERROR]` - Errores de red

### Información de Contexto

Cada log incluye:
- `requestId` - ID único de la solicitud
- `timestamp` - Marca de tiempo
- `endpoint` - Endpoint llamado
- `method` - Método HTTP
- `duration` - Duración de la operación (cuando aplica)
- `error` - Información del error (cuando aplica)
- `context` - Información contextual adicional

## Uso

### En Controladores

```typescript
@Controller('vuelos')
@UseInterceptors(ErrorHandlerInterceptor)
@UseFilters(ErrorHandlerFilter)
export class VuelosController {
  // Los errores se manejan automáticamente
}
```

### En Servicios

```typescript
// Los errores se propagan automáticamente
// El ErrorHandlerService se encarga del manejo
```

### Logging Personalizado

```typescript
// Para logging personalizado
this.logger.log(`[CUSTOM_LOG] Mensaje personalizado`, {
  requestId: logContext.requestId,
  customData: 'valor'
});
```

## Beneficios

1. **Trazabilidad**: Request ID único para seguir solicitudes
2. **Debugging**: Logs detallados para identificar problemas
3. **Monitoreo**: Diferenciación clara entre tipos de errores
4. **Consistencia**: Respuestas de error estandarizadas
5. **Profesionalismo**: Mensajes claros y profesionales
6. **Mantenibilidad**: Código centralizado y reutilizable

## Configuración

El sistema se configura automáticamente al importar el módulo de vuelos. No se requiere configuración adicional.

## Monitoreo

Para monitorear el sistema, buscar logs con los prefijos mencionados y usar el `requestId` para seguir solicitudes específicas a través de toda la aplicación.
