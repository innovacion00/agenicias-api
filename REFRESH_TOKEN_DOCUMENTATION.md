# 🔄 Implementación de Refresh Tokens

## 📋 Resumen

Se ha implementado un sistema completo de refresh tokens para la API de agencias que incluye:

- **Access tokens** con expiración corta (15 minutos)
- **Refresh tokens** con expiración larga (7 días)
- Rotación automática de tokens por seguridad
- Limpieza automática de tokens expirados

## 🏗️ Arquitectura

### Entidades
- `RefreshToken`: Almacena los refresh tokens en MongoDB
- Campos: `userId`, `token`, `expiresAt`, `isActive`, `createdAt`, `updatedAt`

### Servicios
- `AuthService.generateTokenPair()`: Genera access + refresh token
- `AuthService.refreshToken()`: Renueva tokens usando refresh token
- `AuthService.cleanupExpiredRefreshTokens()`: Limpia tokens expirados
- `AuthService.revokeUserRefreshTokens()`: Revoca todos los tokens de un usuario

## 🔗 Endpoints

### 1. Login (Actualizado)
```http
POST /auth/sign-in
```
**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "password": "password123"
}
```
**Respuesta:**
```json
{
  "_id": "user_id",
  "email": "usuario@ejemplo.com",
  "fullName": "Usuario Ejemplo",
  "role": ["user"],
  "agencia": {...},
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6...",
  "expiresIn": "15m"
}
```

### 2. Validar OTP (Actualizado)
```http
POST /auth/validate-otp
```
**Body:**
```json
{
  "email": "usuario@ejemplo.com",
  "otp": "12345"
}
```
**Respuesta:** Igual que el login, incluye ambos tokens.

### 3. Refresh Token (Nuevo)
```http
POST /auth/refresh-token
```
**Body:**
```json
{
  "token": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6..."
}
```
**Respuesta:**
```json
{
  "_id": "user_id",
  "email": "usuario@ejemplo.com",
  "fullName": "Usuario Ejemplo",
  "role": ["user"],
  "agencia": {...},
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1...",
  "expiresIn": "15m"
}
```

## 🔒 Seguridad

### Características de Seguridad Implementadas:

1. **Rotación de Tokens**: Cada vez que se usa un refresh token, se genera uno nuevo y el anterior se desactiva
2. **Expiración Corta de Access Tokens**: 15 minutos para minimizar exposición
3. **Expiración de Refresh Tokens**: 7 días para balance entre seguridad y UX
4. **Desactivación Automática**: Tokens expirados se marcan como inactivos
5. **Validación de Usuario y Agencia**: Se verifica que ambos estén activos al refrescar

## 💻 Uso en Frontend

### Ejemplo con Axios Interceptors:

```javascript
// Configurar interceptor para manejar tokens automáticamente
axios.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post('/auth/refresh-token', {
          token: refreshToken
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        // Reintentar la petición original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return axios(originalRequest);
        
      } catch (refreshError) {
        // Refresh token inválido, redirigir a login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

## 🛠️ Mantenimiento

### Limpieza de Tokens Expirados
Se recomienda ejecutar periódicamente:
```javascript
// En un cron job o tarea programada
await authService.cleanupExpiredRefreshTokens();
```

### Revocar Tokens de Usuario
Para cerrar todas las sesiones de un usuario:
```javascript
await authService.revokeUserRefreshTokens(userId);
```

## ⚠️ Cambios Importantes

1. **Access Tokens ahora expiran en 15 minutos** (antes 365 días)
2. **Nuevos campos en respuestas de login**: `accessToken`, `refreshToken`, `expiresIn`
3. **Campo `token` deprecado**: Usar `accessToken` en su lugar
4. **Nuevo endpoint**: `POST /auth/refresh-token`

## 🧪 Testing

### Ejemplo de Test del Refresh Token:
```javascript
describe('Refresh Token', () => {
  it('should refresh access token with valid refresh token', async () => {
    // Login inicial
    const loginResponse = await request(app)
      .post('/auth/sign-in')
      .send({ email: 'test@test.com', password: 'password' });
    
    const { refreshToken } = loginResponse.body;
    
    // Esperar que expire el access token (o mockear expiración)
    
    // Refrescar token
    const refreshResponse = await request(app)
      .post('/auth/refresh-token')
      .send({ token: refreshToken });
    
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.accessToken).toBeDefined();
    expect(refreshResponse.body.refreshToken).toBeDefined();
    expect(refreshResponse.body.refreshToken).not.toBe(refreshToken); // Nuevo token
  });
});
```

## 📊 Monitoreo

Logs importantes a monitorear:
- Tokens expirados limpiados
- Intentos de uso de refresh tokens inválidos
- Tokens revocados por usuario

## 📁 Archivos Modificados

### Nuevos Archivos:
- `src/auth/entities/refresh-token.entity.ts` - Entidad para almacenar refresh tokens

### Archivos Modificados:
- `src/auth/entities/index.ts` - Exportar nueva entidad
- `src/auth/auth.module.ts` - Configurar nueva entidad y cambiar expiración de tokens
- `src/auth/auth.service.ts` - Agregar métodos de refresh token
- `src/auth/auth.controller.ts` - Nuevo endpoint de refresh token

## 🚀 Estado de la Implementación

✅ **Completado:**
- Entidad RefreshToken creada
- Métodos de generación y validación de tokens
- Endpoint de refresh token
- Rotación automática de tokens
- Limpieza de tokens expirados
- Validaciones de seguridad

La implementación está lista para producción y sigue las mejores prácticas de seguridad para JWT y refresh tokens.
