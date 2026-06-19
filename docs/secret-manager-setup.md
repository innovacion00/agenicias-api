# Secret Manager — Guía de Setup

## Contexto

La API maneja ~22 secretos (API keys, tokens, passwords) definidos en `.env`.
En producción estos secretos deben gestionarse con un secret manager externo.

## Opciones recomendadas

### Opción 1: Doppler (recomendado para equipos pequeños)

1. Crear proyecto en [Doppler](https://doppler.com):
   - Environment `development` para local
   - Environment `staging` / `production` para deploy

2. Sincronizar secretos locales:
   ```bash
   npm run secrets:sync:doppler
   ```

3. En CI/CD, usar el CLI de Doppler:
   ```bash
   doppler run -- node dist/main
   ```

### Opción 2: AWS Secrets Manager / SSM Parameter Store

1. Crear secreto en AWS Secrets Manager con path `/agencias-api/{env}`
2. Cada key del JSON debe coincidir con las variables de `envs.ts`

3. Sincronizar localmente:
   ```bash
   npm run secrets:sync:aws
   ```

4. En producción (ECS/EKS), usar IAM roles:
   ```bash
   node scripts/aws-ssm-sync.ts && node dist/main
   ```

## Clasificación de variables

Ver `.env.example` para la clasificación completa SECRET vs CONFIG de cada variable.

### Secretos (deben ir al secret manager)
- JWT_SECRET
- COBRE_* (USER_ID, SECRET, AUTH_STRING, API_KEY)
- CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- EMAIL_APP_PASSWORD
- SENDGRID_API_KEY
- GOOGLE_GMAIL_* (API_KEY, CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN)
- AUTOCORE_ACCESS_KEY, AUTOCORE_SECRET_KEY
- MY_TOOL_CLAVE
- API_* (13 hotel API endpoints)
- AMADEUS_API_KEY, AMADEUS_API_SECRET
- BOOKING_PERSONAS_TOKEN

### Config (pueden ir como env vars normales)
- PORT, MONGO_URL, REDIS_URL
- URLs base (AUTOCORE_URL, COBRE_API_URL, etc.)
- HOST_BRIDGE
- SENDER_EMAIL

## Rotación de secretos

1. Actualizar el secreto en el manager
2. Reiniciar la aplicación (los secretos se leen al boot)
3. Para zero-downtime: usar rolling restart del deployment
