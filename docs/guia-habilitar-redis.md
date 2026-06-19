# Guía: Habilitar Redis en agencias-api

## Resumen

Redis es **opcional**. Sin él, todo funciona con memoria local (como hasta ahora).
Con Redis habilitado, se centralizan:

1. **Rate limiting** (ThrottlerGuard) — consistente entre réplicas
2. **Distributed locks** — crons no se duplican entre réplicas
3. **Cache centralizado** — RedisCacheService para compartir datos entre procesos

---

## 1. Instalar Redis

### Opción A: Docker (desarrollo local)

```bash
docker run -d --name redis-agencias -p 6379:6379 redis:7-alpine
```

### Opción B: Redis Cloud / AWS ElastiCache (producción)

Crear una instancia Redis y obtener la URL de conexión.

### Opción C: Render / Railway / Upstash (PaaS)

Crear addon Redis y copiar la URL de conexión.

---

## 2. Configurar la variable de entorno

Agregar a tu `.env`:

```env
# Redis (opcional — sin esta variable, se usa memoria local)
REDIS_URL=redis://localhost:6379
```

Para Redis con autenticación:
```env
REDIS_URL=redis://:tu-password@redis-host:6379
```

Para Redis con TLS (producción):
```env
REDIS_URL=rediss://:tu-password@redis-host:6380
```

---

## 3. Verificar conexión

Al iniciar la app, buscar en los logs:

```
✅ Conectado:
[RedisModule] Redis conectado correctamente
[RedisThrottlerStorage] Throttler storage usando Redis

❌ Sin Redis (fallback automático):
[RedisModule] REDIS_URL no configurada — throttler y caches usarán memoria local
[RedisThrottlerStorage] Throttler storage usando memoria local (sin Redis)
```

Si Redis se cae durante la operación:
```
[RedisModule] Redis error: connect ECONNREFUSED
[RedisThrottlerStorage] Redis throttle error, fallback a memoria: ...
```
La app **no se cae** — automáticamente usa memoria local.

---

## 4. Qué cambia con Redis activo

| Componente | Sin Redis | Con Redis |
|---|---|---|
| **Rate limiting** | Cada réplica cuenta independiente (bypass posible) | Conteo centralizado y consistente |
| **Distributed locks** | Locks siempre se adquieren (no hay protección real) | Solo una réplica ejecuta el cron |
| **RedisCacheService** | Map en memoria (por proceso) | Cache compartido entre réplicas |

---

## 5. Usar en servicios propios

### Distributed Lock (proteger operaciones críticas)

```typescript
import { DistributedLockService } from 'src/common/services';

@Injectable()
export class MiServicio {
  constructor(private readonly lock: DistributedLockService) {}

  async operacionCritica() {
    // Solo una réplica ejecuta esto a la vez
    const resultado = await this.lock.tryLock(
      'mi-operacion-unica',      // nombre del lock
      async () => {
        // ... lógica protegida
        return 'ok';
      },
      30000,                      // TTL del lock en ms (auto-release si se cuelga)
    );

    if (resultado === null) {
      // Otra réplica tiene el lock
      console.log('Operación ya en progreso en otra réplica');
    }
  }
}
```

### Redis Cache (compartir datos entre réplicas)

```typescript
import { RedisCacheService } from 'src/common/services';

@Injectable()
export class MiServicio {
  constructor(private readonly cache: RedisCacheService) {}

  async obtenerDatos(id: string) {
    // Intentar cache primero
    const cached = await this.cache.get<MiDato>(`mi-dato:${id}`);
    if (cached) return cached;

    // Calcular y guardar en cache (TTL 5 minutos)
    const dato = await this.calcularDatoExpensivo(id);
    await this.cache.set(`mi-dato:${id}`, dato, 300000);
    return dato;
  }
}
```

---

## 6. Configuración de producción

### Recomendaciones

- **maxmemory**: Configurar `maxmemory 256mb` con política `allkeys-lru`
- **Persistencia**: Para rate limiting y locks, no necesitas persistencia (datos volátiles)
- **Alta disponibilidad**: Redis Sentinel o Redis Cluster para producción crítica
- **Monitoreo**: Usar `redis-cli INFO` o Grafana Redis dashboard

### Variables de entorno para deploy

```env
# Producción
REDIS_URL=rediss://:password@redis-prod.example.com:6380

# Staging (puede ser el mismo Redis con prefijo diferente, o instancia separada)
REDIS_URL=redis://:password@redis-staging.example.com:6379
```

---

## 7. Troubleshooting

| Problema | Causa | Solución |
|---|---|---|
| `Redis error: connect ECONNREFUSED` | Redis no está corriendo | Verificar que Redis esté activo y accesible |
| `Max Redis retries` | Redis caído por más de ~30 segundos | Verificar la instancia Redis; la app sigue con memoria local |
| Logs muestran `fallback a memoria` | Redis no disponible al boot | Configurar REDIS_URL correctamente |
| Rate limits no se comparten | REDIS_URL no configurada | Agregar REDIS_URL al .env |
