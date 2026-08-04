# PR-2.7 — Plantillas de Email con Handlebars

> Sub-plan para migración de funciones de email inline → templates Handlebars.
>
> **Estado:** En preparación (requiere aprobación antes de ejecutar).
>
> **Prerequisitos:** PRs 2.1, 2.2, 2.3 mergeadas; puede ejecutarse en paralelo con 2.4–2.6.
>
> **Bloqueantes para:** PR-2.8 (mecánica final — actualizar imports).

---

## 1. Objetivo

Convertir 13 funciones `notificacion*` que generan HTML inline → 13 plantillas Handlebars (`.hbs`) con helper puro `renderTemplate()`. 

**Resultado:** HTML modular, testeable con snapshots, fácil de mantener. Cero cambio en firmas de funciones → consumidores intactos.

---

## 2. Decisiones de diseño

### D1 — Ubicación de templates

**Decisión:** `src/notificaciones/templates/` (13 `.hbs` + `render.helper.ts`)

```
src/notificaciones/
  templates/
    emails-grupo.hbs
    emails-recordatorio-7d.hbs
    emails-saldo-pendiente.hbs
    emails-reactivacion-exitoso.hbs
    emails-reactivacion-fallido.hbs
    emails-cancelacion-voluntaria.hbs
    emails-cancelacion-tours.hbs
    emails-confirmacion-reserva.hbs
    emails-fallo-pago.hbs
    emails-cambio-estado-manual.hbs
    emails-notificacion-evento.hbs
    emails-invitacion-agencia.hbs
    emails-recuperacion-contrasena.hbs
    render.helper.ts
```

### D2 — Helper render (función pura)

**Decisión:** `renderTemplate(templateName: string, context: object): string`

```ts
// src/notificaciones/templates/render.helper.ts
import Handlebars from 'handlebars';
import fs from 'fs';
import path from 'path';

const cache = new Map<string, HandlebarsTemplateDelegate>();

export function registerHelpers() {
  Handlebars.registerHelper('formatDate', (date: string) => 
    new Date(date).toLocaleDateString('es-CO')
  );
  Handlebars.registerHelper('formatCurrency', (amount: number) => 
    `$${amount.toLocaleString('es-CO')}`
  );
}

export function renderTemplate(templateName: string, context: object): string {
  if (!cache.has(templateName)) {
    const templatePath = path.join(__dirname, `${templateName}.hbs`);
    const content = fs.readFileSync(templatePath, 'utf-8');
    cache.set(templateName, Handlebars.compile(content));
  }
  return cache.get(templateName)!(context);
}
```

**Ventajas:**
- ✅ Cero dependencia de Nest/DI
- ✅ Caché en memoria (lectura FS única)
- ✅ Testeable como función pura
- ✅ Helpers personalizados centralizados

### D3 — Firmas intactas (transparencia para consumidores)

**Decisión:** Funciones `notificacion*` en `src/config/constants/emailPlantillas.ts` conservan firma exacta:

**Antes:**
```ts
export const notificaiconReservaGrupo = (agencia: string, habitacionNum: number, ...) => {
  return `<!DOCTYPE html>...<strong>${agencia}</strong>...`;
};
```

**Después:**
```ts
export const notificaiconReservaGrupo = (agencia: string, habitacionNum: number, ...) => {
  return renderTemplate('emails-grupo', {
    agencia, habitacionNum, hotel, checkin, checkout, reservaChatbotId,
    year: new Date().getFullYear(),
  });
};
```

**Beneficio:** Cero cambio en 40+ call sites (ReservasService, CancellationTasksQueue, etc.). Rollback seguro con `git revert`.

### D4 — Snapshot tests para validar HTML identidad

**Decisión:** 17 snapshot tests Jest comparando HTML antes/después

```ts
// src/notificaciones/templates/__tests__/render.snapshot.spec.ts
describe('Email Templates Snapshots', () => {
  it('notificaiconReservaGrupo matches snapshot', () => {
    const html = notificaiconReservaGrupo(
      'Agencia Test', 2, 'Hotel Caribe', '2026-07-01', '2026-07-03', 'CB123'
    );
    expect(html).toMatchSnapshot();
  });
  // ... 16 tests más (variantes, casos edge)
});
```

**Flujo:**
1. Grabar snapshots de HTML inline actual (`jest --updateSnapshot`)
2. Implementar templates `.hbs` + helper
3. Re-ejecutar tests (`jest`) → deben pasar sin `--updateSnapshot`
4. Commit snapshots a git

---

## 3. Matriz PR × archivos

| Acción | Archivos | Detalles |
|--------|----------|----------|
| **Crear** | 13 templates | `emails-grupo.hbs`, `emails-recordatorio-7d.hbs`, … (total: ~1800 líneas HTML) |
| **Crear** | `render.helper.ts` | 70 líneas: caché + helpers |
| **Crear** | snapshot tests | `render.snapshot.spec.ts` (150 líneas, 17 assertions) |
| **Modificar** | `emailPlantillas.ts` | Cuerpo de 13 funciones = `renderTemplate(...)` |
| **Crear** | `notificaciones.module.ts` | Si no existe; registra helpers Handlebars |
| **Modificar** | `package.json` | Agregar `handlebars@^1.3.0` |
| **Modificar** | `nest-cli.json` | Asegurar que `.hbs` se copien a `dist/` |

### Verificación de disjunción

| PR | Toca | Colisión con 2.7 |
|----|------|-------------------|
| 2.4 | `reservas-booking.service.ts`, `reservas.service.ts` | ✅ No |
| 2.5 | `reservas-pagos.service.ts`, `reservas-emails.service.ts` | ✅ No |
| 2.6 | `reservas-cancelacion.service.ts` | ✅ No |
| **2.7** | **`src/notificaciones/`, `src/config/constants/emailPlantillas.ts`** | — |

**Resultado: Cero conflictos.** PR-2.7 puede ejecutarse en paralelo sin esperar 2.4–2.6.

---

## 4. Plan de tests

### Infraestructura
- Jest (ya configurado)
- `mongodb-memory-server` (para e2e, no necesario para 2.7)
- Handlebars (nueva dependencia)

### Suite de pruebas

| Test | Archivos | Casos |
|------|----------|-------|
| **Unit: render.helper.ts** | `render.helper.spec.ts` | Caché funciona; helpers personalizados disponibles; archivos `.hbs` no encontrados → error |
| **Snapshot: plantillas** | `render.snapshot.spec.ts` | 17 snapshots (13 funciones + 4 variantes: pagado/no pagado, error/éxito) |
| **E2E: workflows** | `mytool-reservas.e2e-spec.ts` (sin cambios) | Confirmación de que emails se renderizan igual en endpoints reales |
| **Build** | `npm run build` | `.hbs` se copian a `dist/notificaciones/templates/` |

### Ejecución

```bash
# Fase A: Grabar snapshots ANTES de migración
npm test -- src/notificaciones/templates --updateSnapshot

# Fase B: Implementar templates + render.helper
# (implementación del desarrollador)

# Fase C: Validar paridad
npm test -- src/notificaciones/templates
# Debe pasar sin --updateSnapshot

# Fase D: E2E completo
npm run test:e2e
# mytool-reservas debe estar verde
```

---

## 5. Riesgos residuales y mitigación

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|-----------|
| **R1: Espacios/saltos de línea en snapshots** | Media | Usar `{{~}}` (Handlebars trim); o normalizar HTML post-render con `minify` |
| **R2: Cliente email (Gmail, Outlook) renderiza diferente** | Baja | Snapshots validan coincidencia con línea base; verificación manual de 2–3 correos reales post-deploy |
| **R3: .hbs no se copia a dist/** | Baja | Configurar `compilerOptions.assets` en `nest-cli.json` si falta |
| **R4: XSS en templates** | Muy baja | Handlebars escapa por defecto `{{ var }}`; solo `{{{ var }}}` para HTML confianza (no usamos) |
| **R5: Dependencia Handlebars obsoleta** | Muy baja | `handlebars@^1.3.0` tiene 10+ años de soporte; mantener actualizado |
| **R6: Snapshots no versionados en git** | Muy baja | Commit `.snap` siempre; gitignore no toca snapshots |

---

## 6. Orden de ejecución

```
t0     PRs 2.1–2.3 (paralelas) → merge
        │
        └→ PR-2.7 (templates) ← PUEDE INICIAR AQUÍ (paralelo con 2.4–2.6)
            │
            ├→ Grabar snapshots
            ├→ Implementar templates + helper
            ├→ Tests snapshot validación
            ├→ Build + e2e
            └→ Merge

t1–3   PRs 2.4–2.6 (secuenciales, dependen 2.1–2.3)
```

**Recomendación:** Lanzar PR-2.7 **inmediatamente tras merge de 2.1–2.3** (t0 tarde) para maximizar paralelismo. No esperar a 2.4–2.6.

---

## 7. Checklist de verificación (pre-merge)

- [ ] 13 plantillas `.hbs` creadas; contenido idéntico a funciones inline
- [ ] `render.helper.ts`: caché + helpers personalizados funcionales
- [ ] 17 snapshot tests pasan sin `--updateSnapshot`
- [ ] `npm run build` limpio; `dist/notificaciones/templates/*.hbs` presentes
- [ ] `npm run lint` → 0 errores
- [ ] `npm run test:e2e` → mytool-reservas verde; emails enviados idénticos
- [ ] `git log --oneline` no toca `src/reservas/` (disjunta confirmada)
- [ ] `git revert <sha>` funciona; build/e2e pasan post-revert
- [ ] Documentación: comentario en `emailPlantillas.ts` sobre nueva ubicación de templates

---

## 8. Ejemplo de migración (detallado)

### Entrada: función inline (hoy)

```ts
// src/config/constants/emailPlantillas.ts
export const notificaiconReservaGrupo = (
  agencia: string,
  habitacionNum: number,
  hotel: string,
  checkin: string,
  checkout: string,
  reservaChatbotId: string,
): string => {
  const year = new Date().getFullYear();
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Nueva Reserva de Grupo</title>
        <style>
          body { font-family: Arial, sans-serif; }
          .email-header { background: #003366; color: white; padding: 20px; }
          .email-body { padding: 20px; }
          .email-footer { background: #f0f0f0; color: #666; padding: 10px; }
          strong { color: #003366; }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="email-header">
            <h1>Nueva Reserva de Grupo</h1>
          </div>
          <div class="email-body">
            <p>La agencia <strong>${agencia}</strong> ha realizado una nueva reserva para grupo.</p>
            <ul>
              <li><strong>Número de habitaciones:</strong> ${habitacionNum}</li>
              <li><strong>Hotel:</strong> ${hotel}</li>
              <li><strong>Check-in:</strong> ${checkin}</li>
              <li><strong>Check-out:</strong> ${checkout}</li>
              <li><strong>ID Reserva:</strong> ${reservaChatbotId}</li>
            </ul>
            <p>Por favor, revisa el detalle de la reserva en tu plataforma.</p>
          </div>
          <div class="email-footer">
            <p>&copy; ${year} GehSuites. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
    </html>
  `;
};
```

### Template Handlebars (nuevo)

```html
<!-- src/notificaciones/templates/emails-grupo.hbs -->
<!DOCTYPE html>
<html>
  <head>
    <title>Nueva Reserva de Grupo</title>
    <style>
      body { font-family: Arial, sans-serif; }
      .email-header { background: #003366; color: white; padding: 20px; }
      .email-body { padding: 20px; }
      .email-footer { background: #f0f0f0; color: #666; padding: 10px; }
      strong { color: #003366; }
    </style>
  </head>
  <body>
    <div class="email-container">
      <div class="email-header">
        <h1>Nueva Reserva de Grupo</h1>
      </div>
      <div class="email-body">
        <p>La agencia <strong>{{agencia}}</strong> ha realizado una nueva reserva para grupo.</p>
        <ul>
          <li><strong>Número de habitaciones:</strong> {{habitacionNum}}</li>
          <li><strong>Hotel:</strong> {{hotel}}</li>
          <li><strong>Check-in:</strong> {{checkin}}</li>
          <li><strong>Check-out:</strong> {{checkout}}</li>
          <li><strong>ID Reserva:</strong> {{reservaChatbotId}}</li>
        </ul>
        <p>Por favor, revisa el detalle de la reserva en tu plataforma.</p>
      </div>
      <div class="email-footer">
        <p>&copy; {{year}} GehSuites. Todos los derechos reservados.</p>
      </div>
    </div>
  </body>
</html>
```

### Función wrapper (conserva firma)

```ts
// src/config/constants/emailPlantillas.ts
import { renderTemplate } from 'src/notificaciones/templates/render.helper';

export const notificaiconReservaGrupo = (
  agencia: string,
  habitacionNum: number,
  hotel: string,
  checkin: string,
  checkout: string,
  reservaChatbotId: string,
): string => {
  return renderTemplate('emails-grupo', {
    agencia,
    habitacionNum,
    hotel,
    checkin,
    checkout,
    reservaChatbotId,
    year: new Date().getFullYear(),
  });
};
```

---

## Resumen ejecutivo

**PR-2.7** migra 13 funciones email → 13 templates Handlebars + helper puro + tests snapshot.

**Impacto:**
- ✅ Cero cambio en 40+ call sites (firmas intactas)
- ✅ Disjunta de PRs 2.4–2.6 (paralelismo total)
- ✅ Testeable (snapshots validan HTML identidad)
- ✅ Fácil mantenimiento (templates modular)
- ✅ Rollback seguro (`git revert`)

**Dependencia:** `handlebars@^1.3.0`

**Duración estimada:** 2–4 horas (implementación + tests + validación)

---

## Aprobación requerida

**Puntos de decisión:**

1. ¿Se acepta la ubicación `src/notificaciones/templates/` para `.hbs`?
2. ¿Se acepta el helper `renderTemplate()` como función pura (no Nest DI)?
3. ¿Se acepta que las 13 funciones usen `renderTemplate()` como wrapper?
4. ¿Se acepta que PR-2.7 corra **en paralelo** con PRs 2.4–2.6?

Si hay dudas o sugerencias, marca los riesgos en §5 y detalla los cambios propuestos.
