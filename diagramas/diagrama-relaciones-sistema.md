# Diagrama de Relaciones - Sistema Completo de Reservas

```mermaid
classDiagram
    class User {
        +ObjectId _id
        +string email
        +string password
        +string firstName
        +string lastName
        +string role
        +ObjectId agenciaId
        +boolean activo
        +Date createdAt
        +Date updatedAt
    }
    
    class Agencia {
        +ObjectId _id
        +string nombre
        +string nit
        +string direccion
        +string telefono
        +string email
        +boolean activa
        +Date createdAt
        +Date updatedAt
    }
    
    class Reserva {
        +ObjectId _id
        +ObjectId userId
        +ObjectId agenciaId
        +string hotel
        +number cantidadHabitaciones
        +number total
        +string status
        +Date fechaLimitePago
        +Date createdAt
    }
    
    class ReservaVuelo {
        +ObjectId _id
        +ObjectId userId
        +ObjectId agenciaId
        +string codigoReserva
        +string estado
        +Date fechaCreacion
        +Date fechaLimitePago
        +number total
        +string moneda
    }
    
    class PaqueteCompleto {
        +ObjectId _id
        +ObjectId reservaId
        +ObjectId reservaVueloId
        +string estado
        +Date fechaCreacion
        +number total
        +string moneda
    }
    
    class PagoReserva {
        +ObjectId _id
        +ObjectId reservaId
        +string tipoPago
        +number monto
        +string estado
        +Date fechaPago
        +string referencia
    }
    
    class NotificacionReserva {
        +ObjectId _id
        +ObjectId userId
        +string tipo
        +string titulo
        +string mensaje
        +boolean leida
        +Date fechaCreacion
    }
    
    class AuditoriaOperacion {
        +ObjectId _id
        +ObjectId userId
        +string operacion
        +string modulo
        +string entidadAfectada
        +ObjectId entidadId
        +any datosAnteriores
        +any datosNuevos
        +string ipUsuario
        +string userAgent
        +Date timestamp
    }

    User ||--o{ Reserva
    User ||--o{ ReservaVuelo
    User ||--o{ PaqueteCompleto
    Agencia ||--o{ User
    Agencia ||--o{ Reserva
    Agencia ||--o{ ReservaVuelo
    PaqueteCompleto ||--|| Reserva
    PaqueteCompleto ||--|| ReservaVuelo
    Reserva ||--o{ PagoReserva
    ReservaVuelo ||--o{ PagoReserva
    PaqueteCompleto ||--o{ PagoReserva
    User ||--o{ NotificacionReserva
    Reserva ||--o{ NotificacionReserva
    ReservaVuelo ||--o{ NotificacionReserva
    PaqueteCompleto ||--o{ NotificacionReserva
    User ||--o{ AuditoriaOperacion

    classDef entityStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef newEntityStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    
    class User,Agencia,Reserva entityStyle
    class ReservaVuelo,PaqueteCompleto,PagoReserva,NotificacionReserva,AuditoriaOperacion newEntityStyle
```

## Descripción de Relaciones

### Relaciones Principales:
- **User** tiene muchas **Reservas** (hotel)
- **User** tiene muchas **ReservasVuelo**
- **User** tiene muchos **PaquetesCompletos**
- **Agencia** contiene muchos **Users**
- **Agencia** gestiona muchas **Reservas** y **ReservasVuelo**

### Relaciones de Paquetes:
- **PaqueteCompleto** incluye una **Reserva** (hotel)
- **PaqueteCompleto** incluye una **ReservaVuelo**

### Relaciones de Pagos:
- **Reserva**, **ReservaVuelo** y **PaqueteCompleto** pueden tener muchos **PagosReserva**

### Relaciones de Notificaciones:
- **User**, **Reserva**, **ReservaVuelo** y **PaqueteCompleto** pueden generar **NotificacionesReserva**

### Relaciones de Auditoría:
- **User** realiza muchas **AuditoriaOperacion**
