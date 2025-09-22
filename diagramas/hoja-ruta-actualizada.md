# **HOJA DE RUTA ACTUALIZADA - SISTEMA PAQUETES HOTEL + VUELO**

## **ANÁLISIS DEL ESTADO ACTUAL**

### **Completado:**
1. **Sistema de hoteles** - Completamente funcional
2. **Integración con Amadeus API** - Búsqueda de ofertas de vuelos
3. **Endpoints básicos** - Búsqueda de ubicaciones, aeropuertos, ciudades
4. **Sistema de manejo de errores** - Centralizado y robusto
5. **Enriquecimiento de respuestas** - Nombres de ciudades en flight-offers
6. **Estructura base** - DTOs, interfaces, servicios

### **En Desarrollo:**
1. **Creación de reservas de vuelos** - Parcialmente implementado
2. **Validación de datos** - Básica implementada

###  **Pendiente:**
1. **Entidades de base de datos** para paquetes hotel+vuelo
2. **Flujo secuencial** hotel primero, vuelo después
3. **Gestión de pagos diferenciada** (inmediato vuelo, fechas límite hotel)
4. **Sistema de notificaciones coordinadas**
5. **Panel de administración** para paquetes
6. **Cancelaciones y devoluciones diferenciadas**

---

## **HOJA DE RUTA DETALLADA ACTUALIZADA**

### **FASE 1: FUNDACIÓN DE BASE DE DATOS** 
**Prioridad:** 🔴 Crítica

#### **1.1 Entidades Principales**
- **PaqueteHotelVuelo Entity**
  - Relación con User y Agencia
  - Referencia a reserva hotel existente
  - Información de vuelos (origen, destino, fechas)
  - Estados diferenciados para hotel y vuelo
  - Información de pasajeros
  
- **PasajeroVuelo Entity**
  - Información personal de cada pasajero
  - Documentos de identidad
  - Validaciones específicas para vuelos

- **VueloSegmento Entity**
  - Detalles de cada segmento del vuelo
  - Aerolínea, número de vuelo
  - Horarios de salida y llegada
  - Aeropuertos y terminales

#### **1.2 Relaciones con Sistema Existente**
- **Reserva Entity** (hoteles) ← → **PaqueteHotelVuelo Entity**
- **Mantener** sistema actual de hoteles intacto
- **Extender** funcionalidad sin romper lo existente

### **FASE 2: FLUJO SECUENCIAL HOTEL → VUELO**
**Prioridad:** 🔴 Crítica

#### **2.1 Implementación del Flujo**
- **Entrada única:** Fechas y ciudades (origen/destino)
- **Paso 1:** Búsqueda y selección de hotel en destino
- **Paso 2:** Búsqueda y selección de vuelo para fechas
- **Paso 3:** Combinación y creación de paquete

#### **2.2 Validaciones Secuenciales**
- **Hotel:** Disponibilidad y confirmación interna
- **Vuelo:** Disponibilidad y confirmación con Amadeus
- **Pasajeros:** Validación de documentos
- **Paquete:** Creación exitosa de ambos componentes

#### **2.3 Estados del Paquete**
```typescript
enum EstadoPaqueteHotelVuelo {
  HOTEL_SELECCIONADO = 0,    // Hotel elegido, esperando vuelo
  VUELO_SELECCIONADO = 1,    // Vuelo elegido, esperando datos
  DATOS_VALIDADOS = 2,       // Datos completos, esperando confirmación
  HOTEL_CONFIRMADO = 3,      // Hotel confirmado internamente
  VUELO_CONFIRMADO = 4,      // Vuelo confirmado con Amadeus
  PAGO_VUELO_PENDIENTE = 5,  // Esperando pago inmediato vuelo
  VUELO_PAGADO = 6,          // Vuelo pagado, boletos emitidos
  HOTEL_PAGO_PENDIENTE = 7,  // Hotel en fechas límite de pago
  COMPLETADO = 8,            // Ambos servicios pagados y confirmados
  CANCELADO = 9              // Paquete cancelado
}
```

### **FASE 3: SISTEMA DE PAGOS DIFERENCIADOS**
**Prioridad:** 🔴 Crítica

#### **3.1 Políticas de Pago Diferenciadas**
- **Vuelo:** Pago inmediato obligatorio
  - No hay fraccionamiento
  - Confirmación instantánea requerida
  - Emisión de boletos automática
  
- **Hotel:** Fechas límite tradicionales
  - Sistema actual de cálculo de fechas
  - Fraccionamiento en dos pagos (primera/segunda mitad)
  - Flexibilidad de pago dentro de límites

#### **3.2 Gestión de Estados de Pago**
- **Independencia:** Cada servicio mantiene su estado
- **Coordinación:** Notificaciones conjuntas
- **Flexibilidad:** Posibilidad de cancelar uno sin afectar el otro

#### **3.3 Integración con Sistema Actual**
- **Reutilizar** lógica de fechas límite para hoteles
- **Extender** Cobre API para pagos inmediatos de vuelos
- **Mantener** compatibilidad con sistema existente

### **FASE 4: NOTIFICACIONES COORDINADAS**
**Prioridad:** 🟡 Alta

#### **4.1 Sistema de Notificaciones Unificado**
- **Confirmación inicial:** Paquete creado exitosamente
- **Vuelo confirmado:** Boletos emitidos y enviados
- **Hotel pendiente:** Recordatorios de fechas límite
- **Paquete completado:** Confirmación final de ambos servicios

#### **4.2 Plantillas Específicas**
- **Paquete creado:** Información de hotel + vuelo
- **Boletos emitidos:** Detalles de vuelo + recordatorio hotel
- **Hotel por vencer:** Recordatorio con info de vuelo ya confirmado
- **Paquete completo:** Confirmación final con todos los detalles

#### **4.3 Coordinación de Servicios**
- **Check-in hotel:** Recordatorios tradicionales
- **Check-in vuelo:** Recordatorios 24h antes
- **Cambios de vuelo:** Notificaciones automáticas
- **Coordinación:** Información cruzada entre servicios

### **FASE 5: PANEL DE ADMINISTRACIÓN UNIFICADO**
**Prioridad:** 🟠 Media

#### **5.1 Dashboard para Agencias**
- **Vista de paquetes:** Estado hotel + vuelo
- **Gestión diferenciada:** Acciones específicas por servicio
- **Seguimiento de pagos:** Estados independientes
- **Reportes combinados:** Métricas de paquetes

#### **5.2 Panel de Super Admin**
- **Supervisión integral:** Todos los paquetes
- **Gestión de conflictos:** Resolución de problemas
- **Métricas avanzadas:** Performance de paquetes
- **Control de fechas:** Monitoreo de límites de pago

#### **5.3 Funcionalidades Específicas**
- **Búsqueda avanzada:** Por estado, fecha, agencia
- **Acciones masivas:** Notificaciones, recordatorios
- **Exportación:** Reportes detallados
- **Alertas:** Pagos próximos a vencer

### **FASE 6: CANCELACIONES Y DEVOLUCIONES DIFERENCIADAS**
**Prioridad:** 🟠 Media

#### **6.1 Políticas de Cancelación**
- **Hotel:** Devolución según políticas existentes
- **Vuelo:** Sin devolución directa (política aerolíneas)
- **Paquete completo:** Evaluación independiente por servicio

#### **6.2 Escenarios de Cancelación**
- **Cancelar todo:** Evaluar ambos componentes
- **Cancelar solo hotel:** Mantener vuelo activo
- **Vuelo cancelado por aerolínea:** Mantener hotel, gestionar crédito
- **Hotel no pagado:** Cancelar hotel, mantener vuelo

#### **6.3 Gestión de Reembolsos**
- **Cálculo independiente:** Cada servicio por separado
- **Reembolso hotel:** Directo según políticas
- **Crédito vuelo:** Gestión según aerolínea
- **Comunicación clara:** Explicar políticas diferenciadas

### **FASE 7: FUNCIONALIDADES AVANZADAS**
**Prioridad:** 🟢 Baja

#### **7.1 Gestión de Cambios**
- **Cambios de vuelo:** Según políticas aerolínea
- **Cambios de hotel:** Sujeto a disponibilidad
- **Coordinación:** Ajustar fechas entre servicios

#### **7.2 Servicios Adicionales**
- **Vuelo:** Asientos, equipaje, comidas
- **Hotel:** Servicios adicionales existentes
- **Coordinación:** Gestión integral de extras

#### **7.3 Integraciones Avanzadas**
- **Check-in automático:** Vuelos cuando sea posible
- **Monitoreo de cambios:** Vuelos en tiempo real
- **Sincronización:** Calendarios y recordatorios

---

## 📊 **BENEFICIOS DEL ENFOQUE ACTUALIZADO**

### **✅ VENTAJAS TÉCNICAS**
- **Simplicidad:** Sin descuentos complejos
- **Claridad:** Flujo secuencial bien definido
- **Reutilización:** Aprovecha sistema actual de hoteles
- **Flexibilidad:** Pagos diferenciados según necesidad

### **✅ VENTAJAS DE NEGOCIO**
- **Oferta completa:** Hotel + vuelo coordinado
- **Transparencia:** Precios claros por servicio
- **Flexibilidad:** Opciones de pago diferenciadas
- **Experiencia mejorada:** Gestión integral

### **✅ VENTAJAS OPERATIVAS**
- **Menos complejidad:** Sin cálculos de descuentos
- **Mantenimiento simple:** Lógicas independientes
- **Escalabilidad:** Fácil agregar nuevos servicios
- **Debugging:** Problemas aislados por servicio

## 🎯 **PRÓXIMOS PASOS INMEDIATOS**

1. **Diseñar entidades BD** - Paquetes y relaciones
2. **Implementar flujo secuencial** - Hotel → Vuelo
3. **Configurar pagos diferenciados** - Inmediato vs fechas límite
4. **Crear notificaciones coordinadas** - Sistema unificado
5. **Desarrollar panel admin** - Gestión integral

Esta hoja de ruta actualizada refleja un enfoque más simple, claro y ejecutable, eliminando complejidades innecesarias y enfocándose en la coordinación efectiva de dos servicios con características de pago diferentes.