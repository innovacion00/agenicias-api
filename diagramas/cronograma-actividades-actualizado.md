# Cronograma de Actividades - Desarrollo Sistema Hotel + Vuelo

```mermaid
gantt
    title Cronograma de Desarrollo - Sistema Paquetes Hotel + Vuelo
    dateFormat  YYYY-MM-DD
    
    section FASE 1: Fundación BD
    Diseño Entidades Paquetes         :active, f1-1, 2024-01-01, 5d
    PaqueteHotelVuelo Entity          :f1-2, after f1-1, 3d
    PasajeroVuelo Entity              :f1-3, after f1-2, 2d
    VueloSegmento Entity              :f1-4, after f1-3, 2d
    Relaciones Hotel-Vuelo            :f1-5, after f1-4, 3d
    Migraciones BD                    :f1-6, after f1-5, 2d
    Testing Entidades                 :f1-7, after f1-6, 3d
    
    section FASE 2: Flujo Secuencial
    Completar Integración Amadeus     :f2-1, after f1-7, 5d
    Flujo Hotel Primero               :f2-2, after f2-1, 4d
    Flujo Vuelo Después               :f2-3, after f2-2, 3d
    Validación Datos Pasajeros        :f2-4, after f2-3, 3d
    Combinación Hotel+Vuelo           :f2-5, after f2-4, 4d
    Confirmación con Amadeus          :f2-6, after f2-5, 4d
    Testing Flujo Completo            :f2-7, after f2-6, 3d
    
    section FASE 3: Pagos Diferenciados
    Análisis Políticas Pago           :f3-1, after f2-2, 3d
    Pago Inmediato Vuelos             :f3-2, after f3-1, 4d
    Fechas Límite Hotel               :f3-3, after f3-2, 3d
    Integración Cobre Diferenciada    :f3-4, after f3-3, 4d
    Gestión Estados Separados         :f3-5, after f3-4, 4d
    Testing Pagos                     :f3-6, after f3-5, 3d
    
    section FASE 4: Notificaciones Coordinadas
    Plantillas Email Paquetes         :f4-1, after f3-3, 3d
    Notificaciones Hotel              :f4-2, after f4-1, 3d
    Notificaciones Vuelo              :f4-3, after f4-2, 3d
    Coordinación Integral             :f4-4, after f4-3, 4d
    Recordatorios Conjuntos           :f4-5, after f4-4, 3d
    Testing Notificaciones            :f4-6, after f4-5, 2d
    
    section FASE 5: Panel Administración
    Dashboard Paquetes                :f5-1, after f4-3, 5d
    Gestión Hotel+Vuelo               :f5-2, after f5-1, 4d
    Control Fechas Límite             :f5-3, after f5-2, 3d
    Panel Super Admin                 :f5-4, after f5-3, 4d
    Reportes Combinados               :f5-5, after f5-4, 4d
    Testing Panel Admin               :f5-6, after f5-5, 3d
    
    section FASE 6: Cancelaciones Diferenciadas
    Políticas Cancelación Hotel       :f6-1, after f5-2, 3d
    Políticas Cancelación Vuelo       :f6-2, after f6-1, 4d
    Cálculo Reembolsos Combinados     :f6-3, after f6-2, 4d
    Gestión Parcial (Solo Hotel)      :f6-4, after f6-3, 3d
    Gestión Parcial (Solo Vuelo)      :f6-5, after f6-4, 3d
    Testing Cancelaciones             :f6-6, after f6-5, 3d
    
    section FASE 7: Funciones Avanzadas
    Gestión Cambios Vuelos            :f7-1, after f6-3, 4d
    Monitoreo Cambios Automático      :f7-2, after f7-1, 4d
    Coordinación Check-ins            :f7-3, after f7-2, 3d
    Servicios Adicionales Vuelo       :f7-4, after f7-3, 4d
    Integraciones Adicionales         :f7-5, after f7-4, 4d
    Testing Funciones Avanzadas       :f7-6, after f7-5, 3d
    
    section FASE 8: Testing y Deploy
    Testing Integración Completa      :f8-1, after f6-6, 7d
    Testing de Carga                  :f8-2, after f8-1, 3d
    Testing Pagos Diferenciados       :f8-3, after f8-2, 4d
    Documentación Técnica             :f8-4, after f8-3, 5d
    Capacitación Usuarios             :f8-5, after f8-4, 3d
    Deploy Producción                 :f8-6, after f8-5, 2d
    Monitoreo Post-Deploy             :f8-7, after f8-6, 7d
    
    section HITOS IMPORTANTES
    MVP Paquetes Hotel+Vuelo          :milestone, m1, after f2-7, 0d
    Sistema Pagos Diferenciados       :milestone, m2, after f3-6, 0d
    Panel Admin Completo              :milestone, m3, after f5-6, 0d
    Cancelaciones Funcionales         :milestone, m4, after f6-6, 0d
    Sistema Completo                  :milestone, m5, after f8-6, 0d
    
    section DEPENDENCIAS CRÍTICAS
    Completar Fix Ciudades            :crit, dep1, 2024-01-01, 2d
    Definir Políticas Negocio         :crit, dep2, 2024-01-03, 3d
    Configurar Ambiente Amadeus       :crit, dep3, 2024-01-06, 2d
    Configurar BD Producción          :crit, dep4, after dep3, 2d
    Integración Cobre Testing         :crit, dep5, after dep4, 3d
```

## 📋 **DETALLES DEL CRONOGRAMA**

### **⏱️ ESTIMACIÓN TOTAL**
- **Duración Total:** 14-18 semanas
- **Recursos Necesarios:** 2-3 desarrolladores
- **Fases Críticas:** 1, 2, 3 (fundación y flujo secuencial)

### **🎯 HITOS CLAVE ACTUALIZADOS**
1. **MVP Paquetes Hotel+Vuelo** - Semana 5
2. **Sistema Pagos Diferenciados** - Semana 8
3. **Panel Admin Completo** - Semana 12
4. **Cancelaciones Funcionales** - Semana 15
5. **Sistema Completo** - Semana 17

### **📊 CAMBIOS PRINCIPALES**

#### **🎯 ENFOQUE ACTUAL:**
- **Flujo secuencial:** Hotel primero, vuelo después
- **Pagos diferenciados:** Inmediato vuelo, fechas límite hotel
- **Gestión coordinada:** Un solo paquete, dos sistemas de pago
- **Administración unificada:** Panel integral

#### **⚠️ RIESGOS REDUCIDOS:**
- **Menos complejidad** sin descuentos
- **Flujo más claro** con secuencia definida
- **Menos puntos de fallo** sin múltiples opciones

### **🔄 PARALELIZACIÓN ACTUALIZADA**
- **Fases 3 y 4** pueden ejecutarse en paralelo
- **Fases 6 y 7** pueden solaparse
- **Testing continuo** durante todo el desarrollo

### **🎯 PRÓXIMOS PASOS INMEDIATOS**

1. **Definir Entidades BD** - Paquetes hotel+vuelo
2. **Configurar Flujo Secuencial** - Hotel → Vuelo
3. **Implementar Pagos Diferenciados** - Inmediato vs fechas límite
4. **Crear Panel Unificado** - Gestión coordinada
5. **Testing Integral** - Flujo completo
