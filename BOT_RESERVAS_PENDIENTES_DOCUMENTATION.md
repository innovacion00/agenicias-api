# 🤖 Bot de Reservas Pendientes de Pago

## 📋 Descripción General

El **Bot de Reservas Pendientes de Pago** es un sistema automatizado que monitorea diariamente las reservas del sistema de Geh Suites para identificar aquellas que requieren atención inmediata en términos de pagos pendientes.

## 🎯 Objetivo

Identificar y reportar automáticamente las reservas que:
- Tienen **status 0** (espera) o **status 5** (mitad pagada)
- Tienen **pagadoPrimeraMitad = true**
- Su **fechaLimitePago** está a **2 días o menos** de vencer

## ⏰ Programación

- **Frecuencia**: Diaria
- **Hora de ejecución**: 8:00 AM (CronExpression.EVERY_DAY_AT_8AM)
- **Proceso**: Automático (no requiere intervención manual)

## 🔍 Criterios de Filtrado

### **Status de Reserva:**
- **0**: Espera (reserva creada, esperando pago)
- **5**: Mitad pagada (primera mitad pagada, pendiente segunda mitad)

### **Estado de Pago:**
- **pagadoPrimeraMitad**: Debe ser `true`

### **Fecha Límite:**
- **fechaLimitePago**: Máximo 2 días restantes para el pago

## 📊 Información Capturada

### **Datos de la Reserva:**
- ID de reserva
- Hotel
- Total y total mitad
- Estado de pago
- Fecha límite de pago
- Días restantes
- Fechas de check-in y check-out
- Información del huésped (nombre, email, teléfono)
- Cantidad de adultos y niños
- Número de noches
- Ciudad y país
- Moneda

### **Datos de la Agencia:**
- Nombre completo
- Categoría (Mayorista/Minorista)
- Tipo (Empresa/Persona Natural)
- Email y teléfono de contacto

### **Datos del Usuario:**
- Nombre completo
- Email
- Teléfono

## 📧 Reporte por Correo

### **Destinatario:**
- **Email**: `reservas@gehsuites.com`
- **Asunto**: "Reservas Pendientes de Pago - Reporte Diario"

### **Contenido del Correo:**
- **HTML**: Formato profesional con estilos CSS
- **Adjunto**: Archivo Excel con todas las reservas pendientes
- **Resumen**: Estadísticas del reporte
- **Advertencias**: Información sobre la urgencia de los pagos

### **Archivo Excel:**
- **Nombre**: `reservas-pendientes-DD-MM-YYYY.xlsx`
- **Formato**: Hoja de cálculo con estilos profesionales
- **Columnas**: 25 columnas con información detallada
- **Resaltado**: Filas con días críticos (≤1 día) en amarillo

## 🏗️ Arquitectura del Sistema

### **Módulos Involucrados:**
```
BotReservasPendientesModule
├── BotReservasPendientesService (Lógica principal)
├── BotReservasPendientesController (Endpoints manuales)
├── ScheduleModule (Programación automática)
├── MongooseModule (Acceso a base de datos)
└── CommonModule (Servicios de email)
```

### **Entidades Utilizadas:**
- **Reserva**: Información de reservas
- **Agencia**: Datos de agencias
- **User**: Información de usuarios

### **Servicios Dependientes:**
- **SendEmailCustomService**: Envío de correos con adjuntos

## 🔧 Funcionalidades

### **1. Ejecución Automática:**
```typescript
@Cron(CronExpression.EVERY_DAY_AT_8AM)
async ejecutarBotReservasPendientes()
```

### **2. Filtrado Inteligente:**
- Consulta optimizada con `populate` para evitar múltiples queries
- Cálculo de días restantes usando `differenceInDays`
- Ordenamiento por urgencia (días restantes)

### **3. Generación de Excel:**
- Uso de **ExcelJS** para crear archivos profesionales
- Estilos personalizados (encabezados, bordes, colores)
- Resaltado automático de reservas críticas

### **4. Envío de Correos:**
- HTML responsive y profesional
- Archivos adjuntos en formato Excel
- Manejo de errores robusto

## 📱 Endpoints Manuales

### **Ejecutar Bot Manualmente:**
```http
POST /agencias/v1/bot-reservas-pendientes/ejecutar-manualmente
```
- **Acceso**: Solo super-admin
- **Uso**: Testing, ejecución manual, emergencias

### **Verificar Estado del Bot:**
```http
POST /agencias/v1/bot-reservas-pendientes/estado
```
- **Acceso**: Solo super-admin
- **Uso**: Monitoreo del estado del bot

## 🚀 Instalación y Configuración

### **Dependencias Requeridas:**
```bash
npm install exceljs @nestjs/schedule date-fns
```

### **Configuración del Módulo:**
```typescript
// app.module.ts
imports: [
  // ... otros módulos
  BotReservasPendientesModule,
]
```

### **Variables de Entorno:**
```env
# Email (ya configurado)
SENDER_EMAIL=tu-email@gmail.com
EMAIL_APP_PASSWORD=tu-app-password
```

## 📊 Monitoreo y Logs

### **Logs del Sistema:**
```
🚀 Iniciando bot de reservas pendientes de pago...
📊 Se encontraron X reservas pendientes de pago
📧 Correo enviado exitosamente a reservas@gehsuites.com con X reservas
✅ Bot de reservas pendientes ejecutado exitosamente
```

### **Logs de Error:**
```
❌ Error en el bot de reservas pendientes: [detalles del error]
```

## 🔒 Seguridad

### **Autenticación:**
- **JWT Guard**: Verificación de tokens
- **Roles Guard**: Control de acceso por roles
- **Validación**: Solo super-admin puede ejecutar manualmente

### **Validaciones:**
- Verificación de datos antes de procesar
- Manejo de errores robusto
- Logs de auditoría completos

## 🧪 Testing

### **Ejecución Manual:**
```bash
# Usar el endpoint manual para testing
curl -X POST http://localhost:3000/agencias/v1/bot-reservas-pendientes/ejecutar-manualmente \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### **Verificación de Estado:**
```bash
curl -X POST http://localhost:3000/agencias/v1/bot-reservas-pendientes/estado \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 📈 Métricas y KPIs

### **Información del Reporte:**
- Total de reservas pendientes
- Fecha y hora de generación
- Distribución por días restantes
- Resumen por agencias

### **Análisis de Datos:**
- Reservas críticas (≤1 día)
- Reservas urgentes (2 días)
- Patrones de pagos pendientes
- Eficiencia del sistema de cobros

## 🚨 Casos de Uso

### **1. Monitoreo Diario:**
- El bot se ejecuta automáticamente cada mañana
- Identifica reservas que requieren atención inmediata
- Genera reporte completo y lo envía por correo

### **2. Gestión de Cobros:**
- El equipo de finanzas recibe el reporte diario
- Puede priorizar las reservas más urgentes
- Contacta a las agencias para gestionar pagos

### **3. Prevención de Pérdidas:**
- Identifica reservas en riesgo de cancelación
- Permite acciones proactivas antes del vencimiento
- Mantiene el flujo de caja saludable

### **4. Auditoría y Control:**
- Registro histórico de reservas pendientes
- Trazabilidad de acciones tomadas
- Cumplimiento de políticas de cobro

## 🔄 Mantenimiento

### **Limpieza de Logs:**
- Los logs se mantienen en el sistema de NestJS
- Se pueden configurar rotaciones automáticas
- Monitoreo de errores y excepciones

### **Actualizaciones:**
- El bot se actualiza automáticamente con el sistema
- No requiere reinicio manual
- Compatible con despliegues continuos

## 📞 Soporte y Contacto

### **Para Reportes:**
- **Email**: `reservas@gehsuites.com`
- **Asunto**: Incluir "Bot Reservas Pendientes" para identificación rápida

### **Para Problemas Técnicos:**
- Revisar logs del sistema
- Verificar configuración de email
- Contactar al equipo de desarrollo

## 🎉 Beneficios del Sistema

### **Para el Negocio:**
- **Reducción de pérdidas** por reservas no pagadas
- **Mejora del flujo de caja** con cobros oportunos
- **Gestión proactiva** de riesgos financieros
- **Auditoría completa** de pagos pendientes

### **Para el Equipo:**
- **Automatización** de tareas repetitivas
- **Reportes estructurados** y fáciles de procesar
- **Alertas tempranas** para acciones preventivas
- **Trazabilidad completa** de todas las operaciones

### **Para las Agencias:**
- **Notificaciones oportunas** sobre pagos pendientes
- **Información clara** sobre fechas límite
- **Prevención** de cancelaciones por falta de pago
- **Mejor gestión** de sus reservas

---

**Desarrollado por:** Equipo de Desarrollo Geh Suites  
**Versión:** 1.0.0  
**Última actualización:** ${new Date().toLocaleDateString('es-ES')}
