# Guía: Gestión de Secrets y Config en agencias-api

## Arquitectura de configuración

Toda la configuración se lee en `src/config/envs.ts`:

```
.env (archivo) → process.env → Joi validation → objeto `envs` (typed)
```

**Regla**: nunca leer `process.env` directamente. Siempre usar `import { envs } from 'src/config'`.

---

## 1. Clasificación: SECRET vs CONFIG

### Secretos (22 variables) — NUNCA commitear

| Categoría | Variables |
|---|---|
| **JWT** | `JWT_SECRET` |
| **Autocore** | `AUTOCORE_ACCESS_KEY`, `AUTOCORE_SECRET_KEY`, `*_DEV` |
| **Cobre** | `COBRE_USER_ID`, `COBRE_SECRET`, `COBRE_AUTH_STRING`, `COBRE_API_KEY` |
| **Cloudinary** | `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **Email** | `EMAIL_APP_PASSWORD`, `SENDGRID_API_KEY` |
| **Google Gmail** | `GOOGLE_GMAIL_API_KEY`, `GOOGLE_GMAIL_CLIENT_ID`, `GOOGLE_GMAIL_CLIENT_SECRET`, `GOOGLE_GMAIL_REFRESH_TOKEN` |
| **My Tool** | `MY_TOOL_CLAVE`, `API_AIXO`, `API_AZUAN`, `API_RODADERO`, ... (13 hotel endpoints) |
| **Amadeus** | `AMADEUS_API_KEY`, `AMADEUS_API_SECRET` |
| **Booking** | `BOOKING_PERSONAS_TOKEN` |
| **MaarLab** | `MAARLAB_PARTNER_SYNC_BEARER` (opcional) |

### Config (25 variables) — OK en repo/docs

| Categoría | Variables |
|---|---|
| **App** | `PORT` |
| **Database** | `MONGO_URL` |
| **Cache** | `REDIS_URL` |
| **URLs base** | `AUTOCORE_URL`, `COBRE_API_URL`, `AMADEUS_BASE_URL`, `MAARLAB_BASE_URL`, `GOOGLE_GMAIL_URL` |
| **Email** | `SENDER_EMAIL`, `CLOUDINARY_NAME` |
| **My Tool** | `MY_TOOL_EMAIL` |
| **Bridge** | `HOST_BRIDGE` |
| **MaarLab** | `MAARLAB_CHAIN_SEARCH_ENGINE_ID` |

---

## 2. Setup para desarrollo local

### Paso 1: Copiar el template

```bash
cp .env.example .env
```

### Paso 2: Llenar los valores

Pedir los secretos al equipo (Slack, 1Password, o el mecanismo interno).

Las variables CONFIG pueden dejarse con valores por defecto del `.env.example`.

### Paso 3: Verificar al arrancar

Si falta alguna variable requerida, la app falla al boot con:

```
Config validation error: "VARIABLE_NAME" is required
```

---

## 3. Setup para producción

### Opción A: Variables de entorno del PaaS (más simple)

Si usan **Render, Railway, Heroku, o ECS con env vars**:

1. Configurar cada SECRET como variable de entorno en el panel del PaaS
2. Las CONFIG también como env vars (o en archivos de config del deploy)
3. **NO subir `.env` al servidor** — las env vars del sistema toman precedencia

```bash
# Ejemplo: Render
render.yaml:
  envVars:
    - key: JWT_SECRET
      sync: false  # No sincronizar desde repo
    - key: MONGO_URL
      value: mongodb+srv://...
```

### Opción B: Doppler (recomendado para equipos)

1. Crear cuenta en [doppler.com](https://doppler.com)
2. Crear proyecto `agencias-api` con environments: `development`, `staging`, `production`
3. Importar variables desde `.env`:
   ```bash
   doppler import --project agencias-api --config dev < .env
   ```
4. Ejecutar la app con Doppler:
   ```bash
   doppler run --project agencias-api --config prd -- node dist/main
   ```

**Ventajas**: versionado de secretos, audit log, rotación, acceso por rol.

### Opción C: AWS Secrets Manager

1. Crear secreto en AWS Secrets Manager:
   - Nombre: `/agencias-api/production`
   - Contenido: JSON con todas las variables
   ```json
   {
     "JWT_SECRET": "...",
     "MONGO_URL": "...",
     "AUTOCORE_ACCESS_KEY": "...",
     ...
   }
   ```

2. En el deploy (ECS/EKS), el task definition inyecta las variables:
   ```json
   {
     "secrets": [
       {
         "name": "JWT_SECRET",
         "valueFrom": "arn:aws:secretsmanager:region:account:secret:/agencias-api/production:JWT_SECRET::"
       }
     ]
   }
   ```

3. Alternativa con SSM Parameter Store (más simple, sin costo adicional):
   ```bash
   aws ssm put-parameter --name "/agencias-api/prod/JWT_SECRET" --value "..." --type SecureString
   ```

---

## 4. Agregar una nueva variable

### Paso 1: Interfaz (tipo)

En `src/config/envs.ts`, agregar al `interface EnvVars`:

```typescript
/** SECRET: Descripción de la variable */
MI_NUEVA_VAR: string;
```

### Paso 2: Validación (Joi)

En el mismo archivo, agregar al `envSchema`:

```typescript
MI_NUEVA_VAR: joi.string().required(),   // o .optional().default('...')
```

### Paso 3: Export

En el objeto `envs`:

```typescript
miNuevaVar: envVars.MI_NUEVA_VAR,
```

### Paso 4: Documentar

En `.env.example`:

```env
# Descripción de la variable (SECRET o CONFIG)
MI_NUEVA_VAR=valor-ejemplo
```

### Paso 5: Usar

```typescript
import { envs } from 'src/config';

const valor = envs.miNuevaVar;
```

---

## 5. Rotación de secretos

### Proceso

1. Generar nuevo valor del secreto
2. Actualizar en el secret manager (Doppler/AWS/env vars del PaaS)
3. Reiniciar la aplicación (rolling restart para zero-downtime)
4. Verificar en logs que la app arrancó correctamente

### Secretos que requieren coordinación

| Secreto | Al rotar, también actualizar en... |
|---|---|
| `JWT_SECRET` | Todos los tokens activos se invalidan (logout forzado) |
| `AUTOCORE_*` | Nada adicional (credenciales independientes) |
| `GOOGLE_GMAIL_REFRESH_TOKEN` | Se regenera automáticamente via OAuth |
| `COBRE_*` | Coordinar con equipo de Cobre |

### Secretos por agencia

`Agencia.maarlabApiKey` se almacena en MongoDB (no en .env).
Para rotarlos: `npm run sync:maarlab-keys` sincroniza desde el partner API.

---

## 6. Troubleshooting

| Error | Causa | Solución |
|---|---|---|
| `Config validation error: "X" is required` | Variable faltante en .env | Agregar la variable |
| `Config validation error: "X" must be a number` | Tipo incorrecto | Verificar formato |
| App arranca pero falla en runtime | Variable con valor incorrecto (URL mal formada, key expirada) | Verificar credenciales con el proveedor |
| `MAARLAB_AUTH_TOKEN` deprecation | Variable legacy | Usar `Agencia.maarlabApiKey` en su lugar |
