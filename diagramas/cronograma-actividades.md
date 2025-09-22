# Cronograma de Actividades - Desarrollo Módulo de Vuelos

```mermaid
gantt
    title Cronograma de Desarrollo - Sistema de Vuelos
    dateFormat  YYYY-MM-DD
    
    section FASE 1: Fundación BD
    Diseño Entidades Vuelos           :active, f1-1, 2024-01-01, 5d
    ReservaVuelo Entity               :f1-2, after f1-1, 3d
    PasajeroVuelo Entity              :f1-3, after f1-2, 2d
    VueloSegmento Entity              :f1-4, after f1-3, 2d
    PaqueteCompleto Entity            :f1-5, after f1-4, 3d
    Migraciones BD                    :f1-6, after f1-5, 2d
    Testing Entidades                 :f1-7, after f1-6, 3d
    
    section FASE 2: Gestión Reservas
    Completar Integración Amadeus     :f2-1, after f1-7, 5d
    Servicios CRUD ReservaVuelo       :f2-2, after f2-1, 4d
    Validación Datos Pasajeros        :f2-3, after f2-2, 3d
    Estados y Transiciones            :f2-4, after f2-3, 4d
    Confirmación con Aerolíneas       :f2-5, after f2-4, 5d
    Emisión de Boletos                :f2-6, after f2-5, 4d
    Testing Reservas                  :f2-7, after f2-6, 3d
    
    section FASE 3: Sistema Pagos
    Análisis Políticas Pago           :f3-1, after f2-1, 3d
    Adaptar Fechas Límite             :f3-2, after f3-1, 3d
    Integración Cobre Vuelos          :f3-3, after f3-2, 4d
    Gestión Devoluciones              :f3-4, after f3-3, 5d
    Políticas Cancelación             :f3-5, after f3-4, 4d
    Testing Pagos                     :f3-6, after f3-5, 3d
    
    section FASE 4: Notificaciones
    Plantillas Email Vuelos           :f4-1, after f3-2, 3d
    Sistema Notificaciones Auto       :f4-2, after f4-1, 4d
    Recordatorios Check-in            :f4-3, after f4-2, 3d
    Notificaciones Cambios Vuelo      :f4-4, after f4-3, 4d
    Testing Notificaciones            :f4-5, after f4-4, 2d
    
    section FASE 5: Paquetes Combinados
    Lógica Combinación Hotel+Vuelo    :f5-1, after f2-4, 5d
    Sistema Descuentos Paquetes       :f5-2, after f5-1, 3d
    Gestión Pagos Diferenciada        :f5-3, after f5-2, 4d
    Servicios CRUD Paquetes           :f5-4, after f5-3, 4d
    Testing Paquetes                  :f5-5, after f5-4, 3d
    
    section FASE 6: Panel Admin
    Dashboard Agencias                :f6-1, after f4-5, 5d
    Gestión Reservas Vuelos           :f6-2, after f6-1, 4d
    Panel Super Admin                 :f6-3, after f6-2, 5d
    Reportes y Analytics              :f6-4, after f6-3, 4d
    Gestión Paquetes UI               :f6-5, after f6-4, 4d
    Testing Panel Admin               :f6-6, after f6-5, 3d
    
    section FASE 7: Funciones Avanzadas
    Gestión Cambios Vuelos            :f7-1, after f6-3, 5d
    Servicios Adicionales             :f7-2, after f7-1, 4d
    Selección Asientos                :f7-3, after f7-2, 4d
    Check-in Automático               :f7-4, after f7-3, 5d
    Integraciones Adicionales         :f7-5, after f7-4, 5d
    Testing Funciones Avanzadas       :f7-6, after f7-5, 3d
    
    section FASE 8: Testing y Deploy
    Testing Integración Completa      :f8-1, after f6-6, 7d
    Testing de Carga                  :f8-2, after f8-1, 3d
    Testing Seguridad                 :f8-3, after f8-2, 3d
    Documentación Técnica             :f8-4, after f8-3, 5d
    Capacitación Usuarios             :f8-5, after f8-4, 3d
    Deploy Producción                 :f8-6, after f8-5, 2d
    Monitoreo Post-Deploy             :f8-7, after f8-6, 7d
    
    section HITOS IMPORTANTES
    MVP Reservas Vuelos               :milestone, m1, after f2-7, 0d
    Sistema Pagos Completo            :milestone, m2, after f3-6, 0d
    Paquetes Funcionales              :milestone, m3, after f5-5, 0d
    Panel Admin Completo              :milestone, m4, after f6-6, 0d
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
- **Duración Total:** 16-20 semanas
- **Recursos Necesarios:** 2-3 desarrolladores
- **Fases Críticas:** 1, 2, 3 (fundación del sistema)

### **🎯 HITOS CLAVE**
1. **MVP Reservas Vuelos** - Semana 6
2. **Sistema Pagos Completo** - Semana 9
3. **Paquetes Funcionales** - Semana 11
4. **Panel Admin Completo** - Semana 14
5. **Sistema Completo** - Semana 18

### **⚠️ RIESGOS Y DEPENDENCIAS**
- **Integración Amadeus** - Riesgo alto, crítico para todo el sistema
- **Políticas de Aerolíneas** - Variables, pueden afectar desarrollo
- **Sincronización con Sistema Actual** - Requiere cuidado especial
- **Testing con Datos Reales** - Necesario ambiente de pruebas robusto

### **🔄 PARALELIZACIÓN**
- **Fases 3 y 4** pueden ejecutarse en paralelo
- **Fases 5 y 6** pueden solaparse
- **Testing continuo** durante todo el desarrollo
