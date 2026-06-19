# Fase 3: Rendimiento — Plan de Diseño

> **Estado**: DISEÑO (en revisión para GATE).
> **Insumos verificados contra código** (2026-06-19):
> - `src/cotizaciones/cotizaciones.service.ts:409-470` (PDF sin try/finally)
> - `src/reservas/services/reservas-search.service.ts` (búsquedas con `all=true`, $regex sin ancla)
> - `src/reservas/services/reservas-count-cache.service.ts` (caché en memoria, TTL 60s)
> - `src/reservas/entities/reserva.entity.ts` (índices existentes por campo)
> - `src/app.module.ts:89-91` (MongoDB pool: maxPoolSize=10)
> - `package.json` (exceljs v4.4.0 ya presente)

---

## 1. Estado actual (hallazgos)

### 1.1 PDF / Puppeteer

**Ubicación**: `src/cotizaciones/cotizaciones.service.ts:409-470`

**Hallazgos**:

| Riesgo | Evidencia | Impacto |
|--------|-----------|--------|
| **Sin try/finally** | líneas 426–457: `browser.launch()`, `page.setContent()`, `page.pdf()`, `await browser.close()` sin `finally` | Si `page.pdf()` lanza → browser huérfano; si Cloudinary falla → pdfUrl nunca asignado pero memoria liberada |
| **Instancia por request** | línea 426: `puppeteer.launch()` a cada llamada | 1–3 s/request + 200–500 MB RAM; con concurrencia=2 simultáneas puede OOM en contenedor < 2 GB |
| **CHROMIUM_PATH env** | línea 427: `process.env.CHROMIUM_PATH \|\| '/usr/bin/chromium-browser'` | Configurable, buen patrón |
| **Sin semáforo de concurrencia** | No hay limitador en el servicio | Dos POST simultáneos a `/cotizaciones/pdf` lanzan dos browsers |
| **Endpoint expuesto** | `CotizacionesController:193-203` POST `/cotizaciones/pdf` protegido por `@Auth()` | Accesible a cualquier usuario autenticado |

**Deuda técnica**:
- No hay invalidación de caché de PDF si se actualiza `landingHtml`
- No hay métricas de duración ni fallos de PDF

---

### 1.2 Queries sin límite y $regex no anclado

**Ubicación múltiple**: `src/reservas/services/reservas-search.service.ts`

#### Rama `all=true` (sin límite)

| Método | Línea | Query | Límite | Riesgo |
|--------|-------|-------|--------|--------|
| `buscarPorNombreAgente` | 218–225 | `.find(filtroBusqueda)` sin `.limit()` | ∞ si all=true | OOM si 10k+ reservas; tasa de transferencia 100+ MB |
| `buscarPorNombreAgencia` | 348–354 | `.find(filtroBusqueda)` sin `.limit()` | ∞ si all=true | ídem |
| `buscarPorNombreHuesped` | 499–505 | `.find(filtroBusqueda)` sin `.limit()` | ∞ si all=true | ídem |
| `buscarPorEstado` | 583–590 | `.find(filtroBusqueda)` sin `.limit()` | ∞ si all=true | ídem |
| `getAllReservas` | 797–803 | `.find(filter)` sin `.limit()` | ∞ si all=true | ídem |

**Uso documentado de `all=true`**:
- `docs/MANUAL_CONSULTA_RESERVAS_POR_ROL.md:195, 229, 295, 416, 429` — ejemplos en UI/API
- Parámetro expuesto en controller via `@Query('all')` (no encontrado en controller pero usado en servicio)

#### $regex sin ancla (prefijo no obligatorio)

| Método | Línea | Patrón | Issue | Impacto |
|--------|-------|--------|-------|--------|
| `buscarPorNombreAgente` | 177 | `fullName: { $regex: nombreEscapado, $options: 'i' }` | Busca substring (no prefijo) | Busca "uan" en "Juan" — válido pero plan Fase 3 anclará a `^` |
| `buscarPorNombreAgencia` | 310 | `fullName: { $regex: nombreEscapado, $options: 'i' }` | Busca substring | ídem |
| `buscarPorNombreHuesped` | 434–436 | `'reservation.firstName': { $regex: nombreEscapado, $options: 'i' }` | Busca substring | Divide por firstName, lastName, completo — lógica correcta |
| `getAllReservas` | 737, 744 | `hotel: { $regex: hotel.trim(), $options: 'i' }` y `fullName: { $regex: nombreAgencia.trim(), $options: 'i' }` | **Sin escapar caracteres** | Injection risk si parámetro contiene `.*+?^${}()\|[]\\` |

**CRÍTICO**: líneas 737, 744 NO escapan input antes de $regex → patrón user-controlled.

**Caché de búsqueda**: NO existe; cada `buscarPor*` con paginación recalcula el count.

---

### 1.3 Índices existentes vs necesarios

**Entidad Reserva** (`src/reservas/entities/reserva.entity.ts`):

| Campo | Línea | Tipo | Índice | Candidato para Fase 3 |
|-------|-------|------|--------|----------------------|
| `userId` | 15 | ref User | ✅ `index: true` | Crear índice compuesto: `{ userId: 1, createdAt: -1 }` |
| `agenciaId` | 18 | ref Agencia | ✅ `index: true` | Crear índice compuesto: `{ agenciaId: 1, createdAt: -1 }` |
| `hotel` | 23 | String | ✅ `index: true` | Añadir campo normalizado `hotelLower: { type: String }` con índice |
| `status` | 208 | Number (enum) | ✅ `index: true` | Crear compuesto: `{ status: 1, createdAt: -1 }` |
| `cancelInProgress` | 215 | Boolean | ✅ `index: true` | Mantener (usado en cancel-lock-reconciliation) |
| `cancelRequestedAt` | 222 | Date | ✅ `index: true` | Mantener (usado en scheduler) |
| `fechaLimitePago` | 329 | String (YYYY-MM-DD) | ✅ `index: true` | Mantener |
| `fechaLimitePago2` | 336 | String | ✅ `index: true` | Mantener |
| `reservation.firstName` | — | String (nested) | ❌ No hay índice | Crear campo desnormalizado `titularFirstNameLower` con índice |
| `reservation.lastName` | — | String (nested) | ❌ No hay índice | Crear campo desnormalizado `titularLastNameLower` con índice |
| `reservation.checkin` | — | String (nested, YYYY-MM-DD) | ❌ No hay índice | Crear campo desnormalizado `reservaCheckin` con índice (usado en filtros de fecha) |
| `reservaChatbotId` | 322 | String, required | ❌ No hay índice **pero es único** | Crear índice `{ reservaChatbotId: 1 }` para la búsqueda exacta en `buscarPorChatbotId` |

**Índices compuestos recomendados** (para las búsquedas más frecuentes):

```javascript
// En seed/migración futura:
db.reservas.createIndex({ userId: 1, status: 1, createdAt: -1 }, { background: true })
db.reservas.createIndex({ agenciaId: 1, status: 1, createdAt: -1 }, { background: true })
db.reservas.createIndex({ status: 1, createdAt: -1 }, { background: true })
db.reservas.createIndex({ hotelLower: 1, createdAt: -1 }, { background: true })
db.reservas.createIndex({ titularFirstNameLower: 1, createdAt: -1 }, { background: true })
db.reservas.createIndex({ titularLastNameLower: 1, createdAt: -1 }, { background: true })
db.reservas.createIndex({ reservaCheckin: 1 }, { background: true })
db.reservas.createIndex({ reservaChatbotId: 1 }, { unique: true, background: true })
```

**Entidad Cotización** (`src/cotizaciones/entities/cotizacion.entity.ts`):

| Campo | Línea | Tipo | Índice | Candidato |
|-------|-------|------|--------|-----------|
| `userId` | 21 | ref User | ✅ `index: true` | Compuesto: `{ userId: 1, createdAt: -1 }` |
| `agenciaId` | 24 | ref Agencia | ✅ `index: true` | Compuesto: `{ agenciaId: 1, createdAt: -1 }` |
| `tokenAcceso` | 27 | String | ✅ `index: true` | Mantener (búsqueda exacta) |
| `status` | — | No visible en líneas primeras | — | Verificar si existe y crear compuesto si es necesario |

---

### 1.4 Caché de counts

**Ubicación**: `src/reservas/services/reservas-count-cache.service.ts`

| Aspecto | Implementación | Línea | Limitación |
|--------|----------------|-------|-----------|
| **Tipo de caché** | `Map<string, { count: number; timestamp }>` en memoria (Singleton) | 21–22 | Perdido al reiniciar; no comparte entre réplicas |
| **TTL** | 60 segundos | 23 | Fijo, no configurable via env |
| **Clave de caché** | `JSON.stringify(filter)` | 39 | No determinista (orden de propiedades); colisiones posibles |
| **Métodos** | `getCachedCount(filter, useCache=true)` | 38 | ✅ Respeta `useCache=false` |
| | `getSumaTotalesNoCanceladas(useCache=true)` | 99 | ✅ Caché separado para suma global |
| | `calcularSumaTotalesPorFiltro(filter)` | 146 | ❌ Sin caché (cálculo en cada request) |
| **Limpieza** | `cleanOldCache()` cada vez que se cachea; elimina > 5 min | 77–94 | Límite de tamaño del Map: ∞ (potencial memory leak si filtros únicos altos) |
| **Invalidación manual** | No existe API pública | — | ❌ Crítico: counts desfasados tras create/cancel/update de reserva |

**Deuda**:
- `calcularSumaTotalesPorFiltro` no está cacheado; se recalcula en cada `buscarPor*` con suma
- Sin invalidación reactiva: crear reserva → count cache sigue viejo hasta TTL
- Sin límite de tamaño del Map: 1 request por cada filtro único → potencial OOM

---

### 1.5 Configuración de MongoDB

**Ubicación**: `src/app.module.ts:89-91`

```typescript
MongooseModule.forRoot(envs.mongoUrl, {
  maxPoolSize: 10,          // Máximo de conexiones en el pool
  minPoolSize: 2,           // Mínimo de conexiones en el pool
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  heartbeatFrequencyMS: 10000,
  retryWrites: true,
  retryReads: true,
})
```

| Config | Valor actual | Recomendación Fase 3 |
|--------|--------------|---------------------|
| `maxPoolSize` | 10 | 30–50 (medir p95 de checkout primero) |
| `minPoolSize` | 2 | Mantener (suficiente para idle) |
| `serverSelectionTimeoutMS` | 5000 | OK |
| `socketTimeoutMS` | 45000 | OK para operaciones largas |
| **Monitoreo** | No instrumentado en logs | Agregar eventos de pool (createdConnection, closedConnection, etc.) |

---

## 2. Diseño propuesto por PR

### PR-3.1: PDF hardening (try/finally + semáforo)

**Archivo principal**: `src/cotizaciones/cotizaciones.service.ts`

**Cambios**:

#### A. Crear servicio de semáforo de Puppeteer

**Archivo nuevo**: `src/cotizaciones/services/puppeteer-pool.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import * as puppeteer from 'puppeteer';

@Injectable()
export class PuppeteerPoolService {
  private readonly logger = new Logger(PuppeteerPoolService.name);
  private browser: puppeteer.Browser | null = null;
  private readonly MAX_CONCURRENT = 2; // Semáforo
  private activeRequests = 0;

  /** Semáforo para controlar concurrencia */
  private async acquireLock(): Promise<void> {
    while (this.activeRequests >= this.MAX_CONCURRENT) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.activeRequests++;
  }

  private releaseLock(): void {
    this.activeRequests--;
  }

  async generatePdf(html: string): Promise<Buffer> {
    await this.acquireLock();
    try {
      if (!this.browser) {
        this.browser = await this.launchBrowser();
      }

      const page = await this.browser.newPage();
      try {
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' },
        });
        return pdfBuffer;
      } finally {
        await page.close();
      }
    } catch (error) {
      this.logger.error('Error generando PDF:', error);
      // Reiniciar browser si falló
      if (this.browser) {
        try {
          await this.browser.close();
        } catch (e) {
          this.logger.warn('Error cerrando browser tras fallo:', e);
        }
        this.browser = null;
      }
      throw error;
    } finally {
      this.releaseLock();
    }
  }

  private async launchBrowser(): Promise<puppeteer.Browser> {
    const chromiumPath = process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser';
    return await puppeteer.launch({
      executablePath: chromiumPath,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    });
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (error) {
        this.logger.error('Error cerrando browser al destruir módulo:', error);
      }
    }
  }
}
```

#### B. Refactorizar `generatePdf()` en CotizacionesService

**Líneas 409–470**: Delegar a `PuppeteerPoolService`:

```typescript
// Inyectar el servicio
constructor(
  // ... otros inyectables
  private puppeteerPool: PuppeteerPoolService,
) {}

async generatePdf(cotizacionId: string): Promise<string> {
  const cotizacion = await this.findOne(cotizacionId);

  if (cotizacion.pdfUrl) {
    return cotizacion.pdfUrl;
  }

  if (!cotizacion.landingHtml) {
    throw new BadRequestException(
      'No hay landing HTML almacenada para generar el PDF',
    );
  }

  const htmlSinBotones = this.removerBotonesDelHTML(cotizacion.landingHtml);

  // Usar el pool (con try/finally interno)
  const pdfBuffer = await this.puppeteerPool.generatePdf(htmlSinBotones);

  // Subir a Cloudinary
  const uploadResult = await this.uploadPdfToCloudinary(
    pdfBuffer,
    `cotizaciones/${cotizacionId}`,
  );

  cotizacion.pdfUrl = uploadResult.secure_url;
  cotizacion.pdfCloudinaryId = uploadResult.public_id;
  await cotizacion.save();

  return cotizacion.pdfUrl;
}
```

#### C. Actualizar CotizacionesModule

```typescript
@Module({
  controllers: [CotizacionesController],
  providers: [
    CotizacionesService,
    PuppeteerPoolService,  // Nuevo
    CloudinaryService,
    AutocoreClient,
  ],
  imports: [
    MongooseModule.forFeature([
      { name: Cotizacion.name, schema: CotizacionSchema },
      { name: Reserva.name, schema: ReservaSchema },
      { name: User.name, schema: UserSchema },
      { name: Agencia.name, schema: AgenciaSchema },
    ]),
    AutocoreModule,
    CloudinaryModule,
  ],
})
export class CotizacionesModule {}
```

**Tests**:
- Unit: test que `acquireLock()` rechaza 3eras request hasta liberar
- Unit: test que excepción en `page.pdf()` trigerea `releaseLock()` + reinicia browser
- E2E: POST `/cotizaciones/pdf` concurrente (5 requests simultáneos) no causa OOM

**Archivos modificados**: 1 (servicio nuevo), 2 (service + module)

---

### PR-3.2: Hard limit + deprecar all=true

**Archivos**: `src/reservas/services/reservas-search.service.ts`, `src/reservas/reservas.controller.ts`, posible archivo nuevo para export

**Cambios**:

#### A. Introducir constante configurable

En `src/config/envs.ts`:

```typescript
interface EnvVars {
  // ... existentes
  RESERVAS_EXPORT_HARD_LIMIT: number; // Nuevo, default 500
}

const envSchema = joi.object({
  // ... existentes
  RESERVAS_EXPORT_HARD_LIMIT: joi.number().default(500),
});

export const envs = {
  // ... existentes
  reservasExportHardLimit: process.env.RESERVAS_EXPORT_HARD_LIMIT || 500,
};
```

#### B. Eliminar `all=true` sin límite (deprecación con warning)

En **cada método** que acepta `all`:

**Antes**:
```typescript
if (all) {
  const [reservas, total] = await Promise.all([
    this.reservasModel
      .find(filtroBusqueda)
      .populate(...)
      .sort(...)
      .lean(),
    this.countCache.getCachedCount(filtroBusqueda),
  ]);
  return { data: reservas, meta: { total, sumaTotales } };
}
```

**Después**:
```typescript
if (all) {
  // Deprecación: limitar a RESERVAS_EXPORT_HARD_LIMIT
  const hardLimit = envs.reservasExportHardLimit; // 500
  const [reservas, total] = await Promise.all([
    this.reservasModel
      .find(filtroBusqueda)
      .populate(...)
      .sort(...)
      .limit(hardLimit)
      .lean(),
    this.countCache.getCachedCount(filtroBusqueda),
  ]);

  return {
    data: reservas,
    meta: {
      total,
      sumaTotales,
      deprecation_warning: `all=true retorna máximo ${hardLimit} registros; para exportar > ${hardLimit}, usar /reservas/export en próximo release`,
    },
  };
}
```

Aplicar a:
- `buscarPorNombreAgente` (línea 217–235)
- `buscarPorNombreAgencia` (línea 347–365)
- `buscarPorNombreHuesped` (línea 498–516)
- `buscarPorEstado` (línea 582–601)
- `getAllReservas` (línea 796–818)

#### C. Endpoint futuro (comentado para Fase 4)

Reservado: `GET /reservas/export?type=csv|excel&filtro=...` con cursor streaming.

**Tests**:
- Unit: `all=true` con 1000 documentos retorna máximo 500 + deprecation_warning
- Unit: paginación normal sin `all=true` sigue sin límite (normal pagination)
- E2E: verificar `meta.deprecation_warning` en la respuesta

**Archivos modificados**: 2 (config, search service) + tests

---

### PR-3.3: Índices + prefijo regex anclado

**Archivos**: 
- `src/reservas/entities/reserva.entity.ts` (agregar campos normalizados)
- `src/reservas/services/reservas-search.service.ts` (anclar $regex)
- Script de migración: `scripts/migrate-normalized-fields.ts`

#### A. Agregar campos desnormalizados a Reserva entity

En `src/reservas/entities/reserva.entity.ts`, después del campo `hotel`:

```typescript
@Prop({
  type: String,
  default: '',
  index: true,  // Índice para búsquedas rápidas
})
hotelLower: string;  // Versión lowercase de 'hotel' para búsquedas

@Prop({
  type: String,
  default: '',
  index: true,
})
titularFirstNameLower: string;  // Versión lowercase de reservation.firstName

@Prop({
  type: String,
  default: '',
  index: true,
})
titularLastNameLower: string;  // Versión lowercase de reservation.lastName

@Prop({
  type: String,
  default: '',
  index: true,
})
reservaCheckin: string;  // Copia de reservation.checkin para índice rápido
```

#### B. Script de migración

**Archivo nuevo**: `scripts/migrate-normalized-fields.ts`

```typescript
import { MongoClient } from 'mongodb';

async function main() {
  const mongoUrl = process.env.MONGO_URL;
  if (!mongoUrl) {
    console.error('MONGO_URL no definida');
    process.exit(1);
  }

  const client = new MongoClient(mongoUrl);
  try {
    await client.connect();
    const db = client.db();
    const reservas = db.collection('reservas');

    console.log('Iniciando migración de campos normalizados...');

    // Procesar por lotes de 1000 para no saturar memoria
    let processed = 0;
    const batchSize = 1000;

    const cursor = reservas.find({});
    let batch = [];

    for await (const doc of cursor) {
      const hotelLower = doc.hotel ? doc.hotel.toLowerCase() : '';
      const titularFirstNameLower = doc.reservation?.firstName
        ? doc.reservation.firstName.toLowerCase()
        : '';
      const titularLastNameLower = doc.reservation?.lastName
        ? doc.reservation.lastName.toLowerCase()
        : '';
      const reservaCheckin = doc.reservation?.checkin || '';

      batch.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              hotelLower,
              titularFirstNameLower,
              titularLastNameLower,
              reservaCheckin,
            },
          },
        },
      });

      if (batch.length === batchSize) {
        await reservas.bulkWrite(batch);
        processed += batch.length;
        console.log(`Procesadas ${processed} reservas...`);
        batch = [];
      }
    }

    // Procesar lote final
    if (batch.length > 0) {
      await reservas.bulkWrite(batch);
      processed += batch.length;
    }

    console.log(`Migración completada: ${processed} reservas actualizadas`);

    // Crear índices
    console.log('Creando índices...');
    await reservas.createIndex(
      { userId: 1, status: 1, createdAt: -1 },
      { background: true },
    );
    await reservas.createIndex(
      { agenciaId: 1, status: 1, createdAt: -1 },
      { background: true },
    );
    await reservas.createIndex(
      { status: 1, createdAt: -1 },
      { background: true },
    );
    await reservas.createIndex(
      { hotelLower: 1, createdAt: -1 },
      { background: true },
    );
    await reservas.createIndex(
      { titularFirstNameLower: 1, createdAt: -1 },
      { background: true },
    );
    await reservas.createIndex(
      { titularLastNameLower: 1, createdAt: -1 },
      { background: true },
    );
    await reservas.createIndex(
      { reservaCheckin: 1 },
      { background: true },
    );
    await reservas.createIndex(
      { reservaChatbotId: 1 },
      { unique: true, background: true },
    );

    console.log('Índices creados exitosamente');
  } finally {
    await client.close();
  }
}

main().catch(console.error);
```

#### C. Usar campos normalizados en búsquedas + anclar $regex

En `src/reservas/services/reservas-search.service.ts`:

**Método `buscarPorNombreAgente` (línea 136–268)**:

Cambiar de:
```typescript
const filtroUsuario: any = {
  fullName: { $regex: nombreEscapado, $options: 'i' },
};
```

A:
```typescript
// Usar campos desnormalizados del hotel
const filtroUsuario: any = {
  fullName: { $regex: `^${nombreEscapado}`, $options: 'i' },
};
```

**Método `buscarPorNombreAgencia` (línea 271–397)**:

```typescript
const filtroAgencia: any = {
  fullName: { $regex: `^${nombreEscapado}`, $options: 'i' },
};
```

**Método `buscarPorNombreHuesped` (línea 400–548)**:

Cambiar de:
```typescript
const condicionesBusqueda: any[] = [
  { 'reservation.firstName': { $regex: nombreEscapado, $options: 'i' } },
  { 'reservation.lastName': { $regex: nombreEscapado, $options: 'i' } },
  // ...
];
```

A:
```typescript
const condicionesBusqueda: any[] = [
  { titularFirstNameLower: { $regex: `^${nombreEscapado.toLowerCase()}`, $options: 'i' } },
  { titularLastNameLower: { $regex: `^${nombreEscapado.toLowerCase()}`, $options: 'i' } },
  // ... resto sin cambios pero usar titularFirstNameLower/titularLastNameLower
];
```

**Método `getAllReservas` (línea 722–855)**:

**CRÍTICO**: Líneas 737, 744 no escapan input. Cambiar de:

```typescript
if (hotel && hotel.trim()) {
  filter.hotel = { $regex: hotel.trim(), $options: 'i' };
}
// ...
if (nombreAgencia && nombreAgencia.trim()) {
  const filtroAgencia: any = {
    fullName: { $regex: nombreAgencia.trim(), $options: 'i' },
  };
```

A:

```typescript
if (hotel && hotel.trim()) {
  const hotelEscapado = this.escapeRegex(hotel.trim());
  filter.hotelLower = { $regex: `^${hotelEscapado.toLowerCase()}`, $options: 'i' };
}
// ...
if (nombreAgencia && nombreAgencia.trim()) {
  const nombreEscapado = this.escapeRegex(nombreAgencia.trim());
  const filtroAgencia: any = {
    fullName: { $regex: `^${nombreEscapado}`, $options: 'i' },
  };
```

#### D. Actualizar package.json script

En `package.json`:

```json
{
  "scripts": {
    "migrate:normalized-fields": "ts-node -r tsconfig-paths/register scripts/migrate-normalized-fields.ts"
  }
}
```

**Tests**:
- Unit: `escapeRegex('.*+?^')` retorna `\\.\\*\\+\\?\\^`
- Unit: búsqueda por `hotelLower` con índice usa IXSCAN (verificar con `explain()`)
- Unit: prefijo anclado `^` no encuentra substring (buscar "uan" en "Juan" falla; buscar "Ju" encuentra)
- E2E: GET `/reservas/buscar/agencia?nombre=Geh` encontrado por prefijo, no substring
- Script: migración sin downtime (incrementalidad, lotes de 1000)

**Archivos modificados**: 2 (entity, search service) + script nuevo + package.json

---

### PR-3.4: Caché de counts con invalidación

**Archivos**: 
- `src/reservas/services/reservas-count-cache.service.ts` (API de invalidación)
- `src/reservas/reservas.service.ts` o nuevo servicio (eventos de invalidación)

#### A. Refactorizar cache key a hash canónico

En `src/reservas/services/reservas-count-cache.service.ts`:

```typescript
private getCacheKey(filter: any): string {
  // Hash canónico del filtro (orden determinista)
  const canonicalFilter = this.canonicalizeFilter(filter);
  const json = JSON.stringify(canonicalFilter);
  // Usar hash simple o crypto.createHash('sha256')
  return require('crypto')
    .createHash('sha256')
    .update(json)
    .digest('hex');
}

private canonicalizeFilter(obj: any): any {
  // Ordenar propiedades recursivamente
  if (typeof obj !== 'object' || obj === null) return obj;
  const ordered: any = {};
  Object.keys(obj)
    .sort()
    .forEach(key => {
      ordered[key] = this.canonicalizeFilter(obj[key]);
    });
  return ordered;
}
```

Cambiar línea 39 de:
```typescript
const cacheKey = JSON.stringify(filter);
```

A:
```typescript
const cacheKey = this.getCacheKey(filter);
```

#### B. Agregar API pública de invalidación

```typescript
/**
 * Invalida entradas de caché. Si filter es null, invalida TODO.
 */
invalidateCache(filter?: any): void {
  if (!filter) {
    // Limpiar todo
    this.countCache.clear();
    this.sumaTotalesCache = null;
    this.logger.debug('Cache de counts completamente invalidado');
    return;
  }

  const cacheKey = this.getCacheKey(filter);
  const deleted = this.countCache.delete(cacheKey);
  if (deleted) {
    this.logger.debug(`Cache invalidado para filtro: ${cacheKey}`);
  }

  // Si el filtro toca status, invalidar suma de totales no canceladas
  if (filter.status !== undefined || Object.keys(filter).length === 0) {
    this.sumaTotalesCache = null;
  }
}
```

#### C. Importar y llamar desde donde se crean/cancelan/actualizan reservas

En `src/reservas/reservas.service.ts` (o donde esté el controller), llamar a:

```typescript
// Al crear reserva
this.countCache.invalidateCache(filtroDelUsuario);

// Al cancelar
this.countCache.invalidateCache({ status: ValidPaymentStatus.cancelada });
this.countCache.invalidateCache(); // O todo si es complejo

// Al cambiar status de pago
this.countCache.invalidateCache({ status: estadoAnterior });
this.countCache.invalidateCache({ status: estadoNuevo });
```

**Decisión de implementación**: Por simplicidad en Fase 3, invalidar **todo el caché** en cada mutación (create, update, cancel). En Fase 4 con Redis, ser más selectivo.

#### D. Límite de tamaño del Map

```typescript
private readonly MAX_CACHE_ENTRIES = 1000;

async getCachedCount(filter: any, useCache = true): Promise<number> {
  // ... lógica existente ...

  // Guardar en caché
  this.countCache.set(cacheKey, { count, timestamp: Date.now() });

  // Limitar tamaño del map
  if (this.countCache.size > this.MAX_CACHE_ENTRIES) {
    const oldestKey = Array.from(this.countCache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp)[0][0];
    this.countCache.delete(oldestKey);
    this.logger.warn(`Cache de counts alcanzó límite (${this.MAX_CACHE_ENTRIES}); eliminado entrada más antigua`);
  }

  this.cleanOldCache();
  return count;
}
```

**Tests**:
- Unit: `invalidateCache(filter)` elimina entrada específica
- Unit: `invalidateCache()` sin args limpia todo
- Unit: Map no crece > 1000 entries (LRU eviction)
- Integration: crear reserva → count cache se invalida → siguiente request recalcula
- E2E: `all=true` después de crear reserva retorna conteo actualizado (sin TTL stale)

**Archivos modificados**: 1 (cache service) + integración en controller/service que crea reservas

---

### PR-3.5: Pool Mongo tuning

**Archivo**: `src/app.module.ts:89-91`

**Cambios**:

#### A. Aumentar maxPoolSize basado en medición

Cambiar de:
```typescript
maxPoolSize: 10,
```

A (después de medir p95):
```typescript
maxPoolSize: 30,  // Aumentado tras medición del driver (KPI línea base)
```

#### B. Agregar instrumentación de eventos de pool

```typescript
import { Logger } from '@nestjs/common';

// En el módulo, después de MongooseModule.forRoot:

// Agregar listeners de pool en onModuleInit
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(@Inject(MongooseModule) private mongooseModule: any) {}

  onModuleInit() {
    const connection = this.mongooseModule.getConnection();
    if (connection && connection.getClient) {
      const client = connection.getClient();
      client.on('connectionCreated', (event) => {
        this.logger.debug(`[MongoDB Pool] Conexión creada: ${event.connectionId}`);
      });
      client.on('connectionClosed', (event) => {
        this.logger.debug(`[MongoDB Pool] Conexión cerrada: ${event.connectionId}`);
      });
      client.on('connectionCheckOutStarted', () => {
        this.logger.debug('[MongoDB Pool] Esperando conexión disponible...');
      });
      client.on('connectionCheckOutFailed', (event) => {
        this.logger.warn(`[MongoDB Pool] Fallo obtener conexión: ${event.reason}`);
      });
    }
  }
}
```

**Tests**:
- E2E: 50 requests concurrentes no causan starvation (todos responden < p95 baseline)
- E2E: logs contienen eventos de pool

**Archivos modificados**: 1 (app.module.ts)

---

## 3. Matriz PR × Archivos

| Archivo | PR-3.1 | PR-3.2 | PR-3.3 | PR-3.4 | PR-3.5 |
|---------|--------|--------|--------|--------|--------|
| `src/config/envs.ts` | — | ✏️ Add limit | — | — | — |
| `src/cotizaciones/cotizaciones.service.ts` | ✏️ Refactor | — | — | — | — |
| `src/cotizaciones/cotizaciones.module.ts` | ✏️ Add pool | — | — | — | — |
| `src/cotizaciones/services/puppeteer-pool.service.ts` | ✨ NEW | — | — | — | — |
| `src/reservas/services/reservas-search.service.ts` | — | ✏️ Add limit | ✏️ Use normalized | — | — |
| `src/reservas/services/reservas-count-cache.service.ts` | — | — | — | ✏️ Add invalidation | — |
| `src/reservas/entities/reserva.entity.ts` | — | — | ✏️ Add fields | — | — |
| `src/reservas/reservas.service.ts` | — | — | — | ✏️ Call invalidate | — |
| `src/app.module.ts` | — | — | — | — | ✏️ Increase pool |
| `scripts/migrate-normalized-fields.ts` | — | — | ✨ NEW | — | — |
| `package.json` | — | — | ✏️ Add script | — | — |

**Paralelización**: PR-3.1, 3.2, 3.3 son independientes (archivos disjuntos) → pueden ejecutarse en paralelo. PR-3.4 depende de que 3.1–3.3 estén hechas (si la implementación es limpia). PR-3.5 depende de mediciones de 3.1–3.4.

---

## 4. Orden de ejecución

```
       ┌─→ PR-3.1 (PDF + semáforo)
Inicio─┼─→ PR-3.2 (hard limit + deprecación all=true)  ← paralelas
       └─→ PR-3.3 (índices + prefijo anclado + migración)
              ↓ (merge de las 3)
            PR-3.4 (invalidación de caché)
              ↓ (merge)
            PR-3.5 (tuning maxPoolSize)
              ↓ (merge)
            CIERRE: Medir KPIs del driver
```

---

## 5. Riesgos y rollback por PR

### PR-3.1: PDF hardening

| Riesgo | Mitigación | Rollback |
|--------|-----------|----------|
| Semáforo de 2 es insuficiente bajo carga | Configurable en `MAX_CONCURRENT`; medida en E2E antes de merge | Revertir a lanzar browser por request (sin semáforo) |
| Browser reusado puede acumular memoria | Monitoreo de pico de RAM durante E2E; implementar flush de pages periódico | Cerrar browser después de cada PDF (menos eficiente pero más seguro) |
| Cambio de API (`PuppeteerPoolService`) impacta otros consumidores de Puppeteer | Búsqueda exhaustiva de usos de Puppeteer en codebase (hoy solo `generatePdf`) | Trivial (solo un call site) |

### PR-3.2: Hard limit

| Riesgo | Mitigación | Rollback |
|--------|-----------|----------|
| Usuarios esperaban `all=true` sin límite | Deprecation warning en `meta` + documentación | Remover `.limit(hardLimit)` y el warning |
| Exportadores de datos se rompen | Aviso en release notes; exportadores deben migrar a /export streaming en próximo release | Restaurar `all=true` sin límite (temporal) |
| Cambio de comportamiento de API | Versión de API (`v2` con límite, `v1` sin cambios) — NO hacer esto; mejor deprecation warning | El warning es la mitigación |

### PR-3.3: Índices + normalized fields

| Riesgo | Mitigación | Rollback |
|--------|-----------|----------|
| Migración falla en producción (lag de MongoDB) | Correr script en ventana de bajo tráfico; monitoreo de operaciones mongod; script idempotente (bulk upsert no insert) | Re-correr script; no requiere downtime |
| Búsquedas con prefijo anclado encuentran menos resultados | Decisiónde producto explícita en el gate; documentar cambio en release notes | Remover ancla `^`, volver a substring matching (pero sin normalización es lento) |
| Índices se crean lentamente (background: true) | Aceptable; `background: true` no bloquea las operaciones CRUD | Eliminar índices con `db.reservas.dropIndex('...')` |
| Campos desnormalizados quedan inconsistentes si `hotel`/`firstName` se actualiza | Agregar hooks de pre-save en la entidad Mongoose para sincronizar | Manual (no crítico pues pocos documentos se actualizan) |

### PR-3.4: Caché con invalidación

| Riesgo | Mitigación | Rollback |
|--------|-----------|----------|
| `invalidateCache()` es llamado en lugar equivocado | Code review exhaustivo; tests unitarios; e2e verifica freshness | Comentar `invalidateCache()` calls y caché vuelve a comportamiento old (TTL sin invalidación) |
| Limit de 1000 entries es muy bajo | Monitoreo en driver; aumentar a 5000 si es necesario | Cambiar `MAX_CACHE_ENTRIES` |

### PR-3.5: Pool tuning

| Riesgo | Mitigación | Rollback |
|--------|-----------|----------|
| `maxPoolSize=30` es muy alto, causando timeout en servidor MongoDB | Medir p95 del driver antes; comenzar con 20, aumentar según métricas | Revertir a 10 (línea 91) |
| Eventos de pool generan logs excesivos | Nivel `debug` (no se ve en prod por defecto) | Remover listeners |

---

## 6. KPIs con línea base → meta

Medidos con el driver (`run-agencias-api`) contra seed de ~50k reservas.

| KPI | Línea base | Meta | Cómo se mide | PR responsable |
|-----|-----------|------|--------------|---|
| **p95 búsqueda por hotel** (50k reservas, paginado) | TBD (a medir) | −70 % vs baseline | `npm run start:dev` con driver; ab -c 5 -n 100 `/reservas?hotel=Cartagena` | 3.3 |
| **Plan de ejecución de búsquedas** (COLLSCAN vs IXSCAN) | COLLSCAN en todas las 5 búsquedas | IXSCAN en todas | `db.reservas.find({...}).explain('executionStats')` | 3.3 |
| **RAM pico generando 5 PDFs concurrentes** | Riesgo OOM (>1.5 GB) | <1.5 GB estable, 0 browsers huérfanos | Monitoreo con `top`; script que POST 5 /pdf simultáneos | 3.1 |
| **Desfase de counts tras crear/cancelar reserva** | Hasta TTL (60 s, stale) | ≤ 0 (invalidación inmediata) o ≤ 1 s (pequeño delay) | Test: crear reserva, immediately GET `/reservas?all=true`, verificar count incluye la nueva | 3.4 |
| **Tiempo de export de 50k reservas** | Hoy `all=true` OOM probable | Streaming (próximo release) + hard limit 500 aquí = máx 500 en una llamada | Test que `all=true` con 50k reservas retorna 500 + aviso | 3.2 |
| **Browsers Chromium huérfanos tras error en PDF** | Sí (sin try/finally) | 0 | Test que forza excepción en `page.pdf()`, verifica con `ps aux \| grep chromium` | 3.1 |
| **Tamaño del Map de cache (entries)** | Infinito (leak potencial) | ≤1000 | Monitoreo interno; test que Map se limpia si se cachen 2000 filtros distintos | 3.4 |
| **Duración de migración de campos normalizados** | N/A (primera vez) | < 5 min para 50k reservas en servidor de test | Timing del script | 3.3 |
| **Índices creados correctamente** | N/A | 8 índices simples + 4 compuestos en la colección Reserva | Verificar con `db.reservas.getIndexes()` | 3.3 |

---

## 7. Verificación pre-gate (Explorador → Arquitecto)

El Explorador (o Verificador) debe confirmar ANTES del gate:

- [ ] Seed del driver genera ~50k reservas reales (no sintéticas)
- [ ] Baseline de p95 búsqueda registrado (ej: 800 ms)
- [ ] Baseline de RAM pico al generar 5 PDFs registrado (ej: 1.8 GB)
- [ ] Baseline de counts stale medido tras crear/cancelar (ej: desfase de 3–60 s)
- [ ] Comandos MongoDB `explain()` ejecutados sobre colecciones reales del driver
- [ ] Estimación de duración de migración de campos normalizados (script seco sobre driver)

---

## 8. Observaciones finales

### Riesgos globales

1. **Cambio de comportamiento de búsquedas** (prefijo anclado): `buscarPor*` con `$regex` no anclado encuentra substrings; anclado encuentra solo prefijos. Requiere aprobación de producto antes del gate.
2. **Migración de campos normalizados**: Data-centric, sin rollback fácil (aunque script es idempotente). Probar exhaustivamente en driver primero.
3. **Puppeteer con browser reutilizado**: Potencial memory leak. Monitoreo continuo en logs post-merge.

### Oportunidades post-Fase 3

- **PR-3.X+1** (Fase 4): Mover `countCache` a Redis (ICountCache interface ya existe)
- **PR-3.X+2** (Fase 4): Implementar `/reservas/export?type=csv|excel` con streaming (deprecar `all=true`)
- **Métrica**: Agregar dashboard con p95 de búsquedas y tasa de error de PDF a Grafana

---

## Aprobación

**Gate**: Este sub-plan requiere aprobación explícita antes de ejecutar PRs. Checklist:

- [ ] Decisión de producto: ¿aceptar cambio de comportamiento de búsquedas (prefijo anclado en lugar de substring)?
- [ ] Decisión de operación: ¿maxPoolSize=30 es aceptable o medir a 20?
- [ ] Decisión técnica: ¿semáforo de Puppeteer con MAX_CONCURRENT=2 es suficiente, o ajustar?
- [ ] Confirmación: Explorador ha medido línea base en driver

