# Versionado de API

## Estado actual

Todas las rutas usan el prefijo global `agencias/v1/`.

## Infraestructura preparada

- Decorador `@ApiVersion('1', '2')` disponible en `src/common/decorators/api-version.decorator.ts`
- Cuando se implemente v2, se habilitara `app.enableVersioning()` en `main.ts`

## Plan de migracion a v2

1. Habilitar `app.enableVersioning({ type: VersioningType.URI })` en `main.ts`
2. Cambiar global prefix de `agencias/v1` a `agencias`
3. Decorar controllers con `@Version('1')` (default) o `@Version('2')` para nuevas versiones
4. Endpoints sin decorador se sirven en todas las versiones

## Ejemplo de uso

```typescript
import { Controller, Get, Version } from '@nestjs/common';

@Controller('reservas')
export class ReservasController {
  @Get()
  @Version('1')
  getAllV1() { /* logica v1 */ }

  @Get()
  @Version('2')
  getAllV2() { /* logica v2 con campos renombrados */ }
}
```
