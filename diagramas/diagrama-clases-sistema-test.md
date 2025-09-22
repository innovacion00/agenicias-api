# Diagrama de Clases - Sistema Completo de Reservas (Test)

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

    User ||--o{ Reserva
```

## Test de Sintaxis Mermaid

Este es un diagrama de prueba para verificar que la sintaxis básica funciona correctamente.
