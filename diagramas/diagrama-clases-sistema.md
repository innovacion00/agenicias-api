# Diagrama de Clases - Sistema Completo de Reservas

```mermaid
classDiagram
    %% ===== ENTIDADES PRINCIPALES =====
    
    class User {
        +ObjectId _id
        +string email
        +string password
        +string telefono
        +string fullName
        +boolean isActive
        +IUserSettings settings
        +boolean firstLog
        +string[] role
        +string imageUrl
        +ObjectId agencia
        +ObjectId otpRef
        +ObjectId[] reservas
        +ObjectId[] eventos
        +ObjectId[] reservasVuelos
        +Date createdAt
        +Date updatedAt
        
        +createUser()
        +updateProfile()
        +changePassword()
        +assignRole()
    }
    
    class Agencia {
        +ObjectId _id
        +string emailContacto
        +string telefonoContacto
        +string fullName
        +string slug
        +number saldo
        +number category
        +IDocumentInfo documentInfo
        +ICobreInfo cobreInfo
        +IAutocoreInfo autocoreInfo
        +boolean empresa
        +boolean isActive
        +User[] usuarios
        +number userLimit
        +boolean permisoCartera
        +Date createdAt
        +Date updatedAt
        
        +createAgencia()
        +addUser()
        +updateSaldo()
        +generateReports()
    }
    
    %% ===== RESERVAS DE HOTEL =====
    
    class Reserva {
        +ObjectId _id
        +ObjectId userId
        +ObjectId agenciaId
        +string hotel
        +number cantidadHabitaciones
        +string origenIata
        +boolean mascotas
        +number mascotasNumber
        +number total
        +number totalMitad
        +boolean adicionCena
        +boolean adicionAlmuerzo
        +boolean pagadoPrimeraMitad
        +string planAlimentario
        +IInfoVuelo infoVuelo
        +IInfoTransporte infoTransporte
        +IInfoToures infoToures
        +IRetenciones retenciones
        +boolean exentoIva
        +ValidPaymentStatus status
        +IAsistente[] asistentes
        +ITitularInfo titularInfo
        +IReservaInfoBd reservation
        +string reservaChatbotId
        +string[] paymenIds
        +string fechaLimitePago
        +string fechaLimitePago2
        +string notasSuperAdmin
        +ILinkInfo linkInfo
        +LinksHistory[] linksHistory
        +Date createdAt
        +Date updatedAt
        
        +createReserva()
        +updateStatus()
        +generatePaymentLink()
        +processPayment()
        +cancelReserva()
        +calculateDates()
    }
    
    %% ===== NUEVAS ENTIDADES PARA VUELOS =====
    
    class ReservaVuelo {
        +ObjectId _id
        +ObjectId userId
        +ObjectId agenciaId
        +ObjectId paqueteId?
        +string codigoReserva
        +string pnrAerolinea
        +EstadoReservaVuelo status
        +IOfertaVuelo ofertaOriginal
        +IPrecioVuelo precio
        +string fechaLimitePago
        +boolean pagado
        +IPoliticaCancelacion politicaCancelacion
        +string notasAdmin
        +ILinkPagoVuelo linkPago
        +Date fechaEmision?
        +Date fechaCancelacion?
        +string motivoCancelacion?
        +Date createdAt
        +Date updatedAt
        
        +createReservaVuelo()
        +confirmarConAerolinea()
        +emitirBoletos()
        +procesarPago()
        +cancelarReserva()
        +calcularTarifasCancelacion()
    }
    
    class PasajeroVuelo {
        +ObjectId _id
        +ObjectId reservaVueloId
        +string nombres
        +string apellidos
        +string tipoDocumento
        +string numeroDocumento
        +Date fechaNacimiento
        +string genero
        +string nacionalidad
        +Date fechaVencimientoDocumento
        +IContactoPasajero contacto
        +IPreferenciasVuelo preferencias
        +string codigoBoletoBoleto?
        +Date createdAt
        +Date updatedAt
        
        +validarDocumento()
        +actualizarPreferencias()
        +generarCodigoBoleto()
    }
    
    class VueloSegmento {
        +ObjectId _id
        +ObjectId reservaVueloId
        +string numeroVuelo
        +string codigoAerolinea
        +string nombreAerolinea
        +IAeropuerto origen
        +IAeropuerto destino
        +Date fechaHoraSalida
        +Date fechaHoraLlegada
        +string duracion
        +string claseServicio
        +string tipoAeronave
        +number numeroStops
        +IEquipaje equipajeIncluido
        +string terminal?
        +string puerta?
        +string asiento?
        +Date createdAt
        +Date updatedAt
        
        +actualizarHorarios()
        +asignarAsiento()
        +validarEquipaje()
    }
    
    %% ===== PAQUETES COMBINADOS =====
    
    class PaqueteCompleto {
        +ObjectId _id
        +ObjectId userId
        +ObjectId agenciaId
        +ObjectId reservaHotelId
        +ObjectId reservaVueloId
        +string codigoPaquete
        +number descuentoPorcentaje
        +number precioOriginal
        +number precioFinal
        +number ahorroTotal
        +EstadoPaquete status
        +IPoliticasPaquete politicas
        +string fechaLimitePago
        +boolean pagadoCompleto
        +IDesglosePagos desglosePagos
        +Date createdAt
        +Date updatedAt
        
        +crearPaquete()
        +calcularDescuentos()
        +procesarPagos()
        +cancelarPaquete()
        +generarFacturacion()
    }
    
    %% ===== GESTIÓN DE PAGOS =====
    
    class PagoReserva {
        +ObjectId _id
        +ObjectId reservaId
        +ObjectId reservaVueloId?
        +ObjectId paqueteId?
        +TipoPago tipo
        +number monto
        +string moneda
        +EstadoPago status
        +string metodoPago
        +string transactionId
        +string linkPagoId
        +Date fechaPago
        +string comprobante?
        +string motivoRechazo?
        +IDetallesPago detalles
        +Date createdAt
        +Date updatedAt
        
        +procesarPago()
        +confirmarPago()
        +rechazarPago()
        +generarComprobante()
        +procesarReembolso()
    }
    
    %% ===== NOTIFICACIONES =====
    
    class NotificacionReserva {
        +ObjectId _id
        +ObjectId userId
        +ObjectId reservaId?
        +ObjectId reservaVueloId?
        +ObjectId paqueteId?
        +TipoNotificacion tipo
        +string asunto
        +string contenido
        +boolean enviada
        +Date fechaEnvio?
        +string canalEnvio
        +number intentosEnvio
        +string errorEnvio?
        +Date fechaProgramada
        +Date createdAt
        +Date updatedAt
        
        +programarNotificacion()
        +enviarNotificacion()
        +reintentarEnvio()
        +marcarComoEnviada()
    }
    
    %% ===== ADMINISTRACIÓN =====
    
    class ConfiguracionSistema {
        +ObjectId _id
        +string modulo
        +string clave
        +any valor
        +string descripcion
        +boolean activa
        +Date fechaModificacion
        +ObjectId usuarioModificacion
        
        +actualizarConfiguracion()
        +obtenerConfiguracion()
        +validarConfiguracion()
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
        
        +registrarOperacion()
        +consultarAuditoria()
        +generarReporte()
    }

    %% ===== ENUMS =====
    
    class EstadoReservaVuelo {
        <<enumeration>>
        COTIZADA
        PENDIENTE_PAGO
        PAGADA
        CONFIRMADA
        EMITIDA
        CANCELADA
        REEMBOLSADA
    }
    
    class EstadoPaquete {
        <<enumeration>>
        COTIZADO
        PENDIENTE_PAGO
        PAGO_PARCIAL
        PAGADO
        CONFIRMADO
        ACTIVO
        CANCELADO
    }
    
    class TipoPago {
        <<enumeration>>
        HOTEL_PRIMERA_MITAD
        HOTEL_SEGUNDA_MITAD
        VUELO_COMPLETO
        PAQUETE_COMPLETO
        REEMBOLSO
    }
    
    class TipoNotificacion {
        <<enumeration>>
        CONFIRMACION_RESERVA
        RECORDATORIO_PAGO
        CONFIRMACION_PAGO
        BOLETOS_EMITIDOS
        RECORDATORIO_CHECKIN
        CAMBIO_VUELO
        CANCELACION
        REEMBOLSO
    }
    
    %% ===== INTERFACES PRINCIPALES =====
    
    class IOfertaVuelo {
        <<interface>>
        +string id
        +IItinerario[] itinerarios
        +IPrecio precio
        +string[] aerolineasValidadoras
        +boolean requiereEmisionInmediata
        +string fechaLimiteEmision
        +number asientosDisponibles
    }
    
    class IPrecioVuelo {
        <<interface>>
        +string moneda
        +number total
        +number base
        +any[] tasas
        +number totalFinal
        +any[] descuentos
    }
    
    class IAeropuerto {
        <<interface>>
        +string codigoIATA
        +string nombre
        +string ciudad
        +string pais
        +string terminal
        +string zona
    }
    
    class IEquipaje {
        <<interface>>
        +number pesoPermitido
        +string unidad
        +number piezasPermitidas
        +boolean equipajeManoIncluido
    }

    
    %% Estilos
    classDef entityStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef newEntityStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef enumStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef interfaceStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    
    class User,Agencia,Reserva entityStyle
    class ReservaVuelo,PasajeroVuelo,VueloSegmento,PaqueteCompleto,PagoReserva,NotificacionReserva newEntityStyle
    class EstadoReservaVuelo,EstadoPaquete,TipoPago,TipoNotificacion enumStyle
    class IOfertaVuelo,IPrecioVuelo,IAeropuerto,IEquipaje interfaceStyle
```
