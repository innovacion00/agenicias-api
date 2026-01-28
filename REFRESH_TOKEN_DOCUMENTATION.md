# 🔄 Implementación de Refresh Tokens

## 📋 Resumen

Sistema de refresh tokens para la API de agencias con:

- **Access tokens** con expiración configurable (`JWT_ACCESS_EXPIRES_IN`, por defecto 60m)
- **Refresh tokens** con **expiración deslizante** (`REFRESH_TOKEN_SLIDING_DAYS`, por defecto 7 días de inactividad)
- **Múltiples sesiones simultáneas**: varios dispositivos/navegadores pueden estar logueados a la vez
- Rotación automática de tokens por seguridad
- Limpieza automática de tokens expirados (cron diario a las 3:00 AM)
- Endpoints de sesión: logout, listar sesiones, revocar una sesión o todas

## 🏗️ Arquitectura

### Entidades
- `RefreshToken`: Almacena sesiones/refresh tokens en MongoDB
- Campos: `userId`, `token`, `expiresAt`, `lastUsedAt`, `isActive`, `deviceInfo` (opcional), `ip` (opcional), `createdAt`, `updatedAt`
- `lastUsedAt` se usa para expiración deslizante; `deviceInfo` e `ip` para listar y revocar sesiones por dispositivo

### Servicios
- `AuthService.generateTokenPair()`: Genera access + refresh token (no invalida otras sesiones)
- `AuthService.refreshToken()`: Renueva tokens con validación de ventana deslizante y rotación
- `AuthService.logout()`: Revoca la sesión asociada al refresh token enviado
- `AuthService.getSessions()`: Lista sesiones activas del usuario (sin el token)
- `AuthService.revokeSessionById()`: Revoca una sesión por ID
- `AuthService.revokeUserRefreshTokens()`: Revoca todas las sesiones del usuario
- `AuthService.cleanupExpiredRefreshTokens()`: Elimina tokens expirados o inactivos (invocado por cron diario)

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
  "expiresIn": "60m"
}
```
El valor de `expiresIn` viene de la variable de entorno `JWT_ACCESS_EXPIRES_IN` (por defecto `60m`).

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
  "expiresIn": "60m"
}
```

### 4. Logout (Cerrar sesión actual)
```http
POST /auth/logout
```
**Body:**
```json
{
  "token": "<refresh_token>"
}
```
**Respuesta:** `{ "ok": true }`. La sesión asociada al refresh token se marca como inactiva.

### 5. Revocar todas las sesiones
```http
POST /auth/revoke-all-sessions
Authorization: Bearer <access_token>
```
**Respuesta:** `{ "revokedCount": N }`. Útil tras cambio de contraseña o “cerrar sesión en todos los dispositivos”.

### 6. Listar sesiones activas
```http
GET /auth/sessions
Authorization: Bearer <access_token>
```
**Respuesta:** Lista de sesiones con `id`, `lastUsedAt`, `deviceInfo`, `createdAt` (sin el token).

### 7. Revocar una sesión por ID
```http
DELETE /auth/sessions/:sessionId
Authorization: Bearer <access_token>
```
**Respuesta:** `{ "ok": true }`. Solo se revoca si la sesión pertenece al usuario autenticado.

## 🔄 **Flujo Completo del Sistema de Refresh Tokens**

### **📊 Diagrama del Flujo:**

```
1. LOGIN INICIAL
   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │ Usuario + Pass  │───▶│   AuthService   │───▶│  Respuesta con  │
   │                 │    │                 │    │  Ambos Tokens   │
   └─────────────────┘    └─────────────────┘    └─────────────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │  Base de Datos  │
                           │ RefreshToken    │
                           │ (7 días exp.)   │
                           └─────────────────┘

2. USO DE ACCESS TOKEN
   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │ Frontend        │───▶│   API Endpoint  │───▶│  Respuesta      │
   │ Bearer Token    │    │   (15 min exp.) │    │  Exitosa        │
   └─────────────────┘    └─────────────────┘    └─────────────────┘

3. ACCESS TOKEN EXPIRADO
   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │ Frontend        │───▶│   API Endpoint  │───▶│  401 Unauthorized│
   │ Bearer Token    │    │   (Expirado)    │    │                 │
   │ (Expirado)      │    │                 │    └─────────────────┘
   └─────────────────┘    └─────────────────┘

4. REFRESH AUTOMÁTICO
   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │ Interceptor     │───▶│ Refresh Endpoint│───▶│  Nuevos Tokens  │
   │ Axios           │    │                 │    │                 │
   └─────────────────┘    └─────────────────┘    └─────────────────┘
                                    │
                                    ▼
                           ┌─────────────────┐
                           │  Base de Datos  │
                           │ RefreshToken    │
                           │ (Anterior →     │
                           │  Inactivo)      │
                           └─────────────────┘

5. REINTENTO AUTOMÁTICO
   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
   │ Interceptor     │───▶│   API Endpoint  │───▶│  Respuesta      │
   │ Axios           │    │   (Nuevo Token) │    │  Exitosa        │
   │ (Nuevo Token)   │    │                 │    │                 │
   └─────────────────┘    └─────────────────┘    └─────────────────┘
```

### **🔍 Explicación Detallada del Flujo:**

#### **FASE 1: Autenticación Inicial**
1. **Usuario hace login** con email y password (cada dispositivo/navegador crea una sesión nueva; las demás no se invalidan).
2. **Sistema valida credenciales** y genera:
   - **Access Token** (JWT, expiración configurable por `JWT_ACCESS_EXPIRES_IN`)
   - **Refresh Token** (string único con ventana deslizante de `REFRESH_TOKEN_SLIDING_DAYS` días)
3. **Refresh Token se almacena** en la base de datos con:
   - `userId`, `token`, `expiresAt`, `lastUsedAt`, `isActive`, opcionalmente `deviceInfo` e `ip`
4. **Frontend recibe ambos tokens** y los almacena

#### **FASE 2: Uso Normal de la API**
1. **Frontend incluye Access Token** en header `Authorization: Bearer <token>`
2. **API valida el token** y permite acceso a recursos protegidos
3. **Cada petición exitosa** usa el mismo Access Token
4. **El token permanece válido** hasta que expire (15 minutos)

#### **FASE 3: Detección de Token Expirado**
1. **Access Token expira** después de 15 minutos
2. **API rechaza la petición** con error 401 Unauthorized
3. **Interceptor de Axios detecta** el error 401
4. **Se activa el proceso de refresh** automáticamente

#### **FASE 4: Proceso de Refresh**
1. **Interceptor obtiene** el Refresh Token del localStorage
2. **Hace petición POST** a `/auth/refresh-token`
3. **Sistema valida** el Refresh Token:
   - Verifica que exista en la base de datos y esté activo
   - Valida que no haya expirado (`expiresAt`)
   - **Expiración deslizante**: si no se ha usado en los últimos `REFRESH_TOKEN_SLIDING_DAYS` días (`lastUsedAt`), la sesión se considera expirada por inactividad
   - Verifica que el usuario y la agencia estén activos
4. **Si es válido**, genera nuevos tokens (rotación):
   - **Nuevo Access Token** y **Nuevo Refresh Token** con nueva ventana deslizante
5. **Refresh Token anterior se desactiva** (`isActive: false`)
6. **Nuevo Refresh Token se almacena** como nueva sesión

#### **FASE 5: Actualización y Reintento**
1. **Frontend actualiza** ambos tokens en localStorage
2. **Interceptor reintenta** la petición original con el nuevo Access Token
3. **Usuario continúa** usando la aplicación sin interrupciones
4. **Proceso es transparente** para el usuario final

### **⏰ Cronología de Expiración**

- **Access Token:** Expira según `JWT_ACCESS_EXPIRES_IN` (ej. 60m). Al expirar, el cliente debe usar el refresh token.
- **Refresh Token (expiración deslizante):** La sesión sigue válida mientras se use al menos una vez cada `REFRESH_TOKEN_SLIDING_DAYS` días (por defecto 7). Si el usuario no usa el refresh token durante ese período, la sesión expira por inactividad y debe hacer login de nuevo.
- **Múltiples sesiones:** Cada login (o validate-otp) crea una sesión nueva sin cerrar las demás. Hay un límite opcional por usuario (`MAX_SESSIONS_PER_USER`, por defecto 10); si se supera, se desactiva la sesión más antigua por `lastUsedAt`.

### **🔄 Rotación de Tokens (Seguridad):**

- **Cada refresh genera tokens completamente nuevos**
- **Refresh Token anterior se invalida inmediatamente**
- **Previene reutilización de tokens comprometidos**
- **Mantiene sesión activa sin comprometer seguridad**

## 🔒 **Características de Seguridad Implementadas:**

### **⚠️ Nota sobre Almacenamiento de Tokens:**
> **Importante:** Al usar cookies o localStorage accesibles desde JavaScript, los tokens están expuestos a ataques XSS (Cross-Site Scripting). 
> 
> **Recomendaciones de seguridad:**
> - Implementar validación de entrada estricta
> - Usar CSP (Content Security Policy) headers
> - Sanitizar todo el contenido renderizado
> - Mantener dependencias actualizadas
> - Considerar el uso de httpOnly cookies en entornos de alta seguridad

### **🛡️ Medidas de Seguridad Implementadas**

1. **Rotación de Tokens**: Cada refresh genera tokens nuevos y desactiva el anterior
2. **Expiración de Access Token**: Configurable (`JWT_ACCESS_EXPIRES_IN`) para minimizar exposición
3. **Expiración deslizante de Refresh Token**: La sesión caduca si no se usa en `REFRESH_TOKEN_SLIDING_DAYS` días
4. **Múltiples sesiones**: Cada dispositivo mantiene su propia sesión; el usuario puede listar y revocar sesiones concretas
5. **Logout**: Endpoint para cerrar la sesión actual enviando el refresh token
6. **Revocar todas las sesiones**: Útil tras cambio de contraseña
7. **Validación en Base de Datos**: Refresh tokens se validan contra la BD
8. **Limpieza automática**: Cron diario (3:00 AM) elimina tokens expirados o inactivos

### **Variables de entorno**

- `JWT_ACCESS_EXPIRES_IN`: Expiración del access token (ej. `15m`, `60m`). Por defecto `60m`.
- `REFRESH_TOKEN_SLIDING_DAYS`: Días de inactividad antes de expirar la sesión. Por defecto `7`.
- `MAX_SESSIONS_PER_USER`: Máximo de sesiones activas por usuario. Por defecto `10`.

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

## 🛠️ **Mantenimiento y Administración**

### **🧹 Limpieza de Tokens Expirados**
Se recomienda ejecutar periódicamente (cada 24 horas):
```javascript
// En un cron job o tarea programada
await authService.cleanupExpiredRefreshTokens();
```

### **🚫 Revocar Tokens de Usuario**
Para cerrar todas las sesiones de un usuario (útil en casos de seguridad):
```javascript
await authService.revokeUserRefreshTokens(userId);
```

### **📊 Monitoreo de Tokens**
```javascript
// Verificar tokens activos de un usuario
const activeTokens = await refreshTokenModel.find({
  userId: userId,
  isActive: true
});

// Verificar tokens próximos a expirar
const expiringSoon = await refreshTokenModel.find({
  expiresAt: { 
    $gte: new Date(), 
    $lte: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
  },
  isActive: true
});
```

## 🔍 **Casos de Uso y Escenarios**

### **📱 Escenario 1: Usuario Activo en Múltiples Dispositivos**
```
Usuario hace login en:
- Computadora de escritorio
- Laptop
- Teléfono móvil
- Tablet

Cada dispositivo tiene su propio refresh token
Todos funcionan independientemente
Si uno se compromete, solo se revoca ese dispositivo
```

### **🔄 Escenario 2: Refresh Token Comprometido**
```
1. Refresh Token se filtra (por ejemplo, en logs)
2. Atacante intenta usarlo
3. Sistema detecta uso sospechoso
4. Administrador revoca todos los tokens del usuario
5. Usuario debe hacer login nuevamente
6. Todos los dispositivos se desconectan
```

### **⏰ Escenario 3: Usuario Inactivo**
```
1. Usuario no usa la app por 7 días
2. Refresh Token expira automáticamente
3. Usuario intenta usar la app
4. Sistema detecta token expirado
5. Usuario es redirigido al login
6. Nueva sesión se inicia
```

### **🛡️ Escenario 4: Cambio de Contraseña**
```
1. Usuario cambia su contraseña
2. Sistema invalida todos los refresh tokens
3. Usuario debe hacer login en todos los dispositivos
4. Previene acceso con tokens antiguos
5. Mejora la seguridad de la cuenta
```

## 🚨 **Manejo de Errores y Casos Edge**

### **❌ Errores Comunes:**

#### **Refresh Token Inválido:**
```json
{
  "statusCode": 401,
  "message": "Invalid refresh token"
}
```
**Causa:** Token no existe en la base de datos o fue revocado
**Solución:** Usuario debe hacer login nuevamente

#### **Refresh Token Expirado:**
```json
{
  "statusCode": 401,
  "message": "Refresh token expired"
}
```
**Causa:** Token superó los 7 días de validez
**Solución:** Usuario debe hacer login nuevamente

#### **Usuario Inactivo:**
```json
{
  "statusCode": 401,
  "message": "User not found or inactive"
}
```
**Causa:** Usuario fue desactivado o eliminado
**Solución:** Contactar administrador

#### **Agencia Inactiva:**
```json
{
  "statusCode": 403,
  "message": "Agency not active"
}
```
**Causa:** La agencia del usuario fue desactivada
**Solución:** Contactar administrador de la agencia

### **⚠️ Casos Edge:**

#### **Múltiples Refresh Simultáneos:**
```
Si el usuario hace múltiples peticiones simultáneamente:
- Solo la primera petición de refresh será exitosa
- Las demás fallarán (token ya usado)
- Sistema maneja esto automáticamente
- Usuario puede reintentar la petición original
```

#### **Race Conditions:**
```
Interceptor detecta 401 → Inicia refresh
Usuario hace otra petición → También detecta 401
Solo un refresh se ejecuta exitosamente
Las demás peticiones esperan y se reintentan
```

#### **Dispositivo Sin Conexión:**
```
Usuario pierde conexión durante refresh:
- Petición de refresh falla
- Usuario es redirigido al login
- Al recuperar conexión, puede hacer login nuevamente
```

## ⚠️ Cambios Importantes

1. **Access Tokens ahora expiran en 15 minutos** (antes 365 días)
2. **Nuevos campos en respuestas de login**: `accessToken`, `refreshToken`, `expiresIn`
3. **Campo `token` deprecado**: Usar `accessToken` en su lugar
4. **Nuevo endpoint**: `POST /auth/refresh-token`

## 🧪 **Testing y Validación**

### **✅ Test del Refresh Token:**
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

  it('should reject expired refresh token', async () => {
    // Mockear refresh token expirado
    const expiredToken = 'expired-token';
    
    const response = await request(app)
      .post('/auth/refresh-token')
      .send({ token: expiredToken });
    
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Refresh token expired');
  });

  it('should reject invalid refresh token', async () => {
    const invalidToken = 'invalid-token';
    
    const response = await request(app)
      .post('/auth/refresh-token')
      .send({ token: invalidToken });
    
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Invalid refresh token');
  });
});
```

## 🚀 **Implementación Práctica y Mejores Prácticas**

### **🔧 Configuración del Frontend:**

#### **1. Configuración de Axios:**
```javascript
// config/axios.js
import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:3000/agencias/v1',
  timeout: 10000,
});

// Interceptor para agregar token automáticamente
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar refresh automático
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await api.post('/auth/refresh-token', {
          token: refreshToken
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        // Actualizar tokens en localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        
        // Reintentar la petición original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // Refresh falló, limpiar tokens y redirigir a login
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        
        // Redirigir a login
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

#### **2. Hook Personalizado para Auth:**
```javascript
// hooks/useAuth.js
import { useState, useEffect, useCallback } from 'react';
import api from '../config/axios';

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      const response = await api.post('/auth/sign-in', credentials);
      
      const { accessToken, refreshToken, ...userData } = response.data;
      
      // Guardar tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      
      // Guardar usuario
      setUser(userData);
      setError(null);
      
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'Error en login');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setError(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.post('/auth/refresh-token', {
        token: localStorage.getItem('refreshToken')
      });
      
      const { accessToken, refreshToken, ...userData } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      setUser(userData);
      
      return response.data;
    } catch (err) {
      logout();
      throw err;
    }
  }, [logout]);

  useEffect(() => {
    // Verificar si hay tokens al cargar la app
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (accessToken && refreshToken) {
      // Intentar validar el token actual
      api.get('/auth/validar-token', { data: accessToken })
        .then(() => {
          // Token válido, obtener datos del usuario
          // Aquí podrías hacer una petición para obtener datos del usuario
        })
        .catch(() => {
          // Token inválido, intentar refresh
          refreshUser().catch(() => {
            logout();
          });
        });
    }
    
    setLoading(false);
  }, [refreshUser, logout]);

  return {
    user,
    loading,
    error,
    login,
    logout,
    refreshUser,
    isAuthenticated: !!user
  };
};
```

### **🛡️ Mejores Prácticas de Seguridad:**

#### **1. Almacenamiento Seguro:**
```javascript
// ✅ Opción 1: localStorage (persistente entre sesiones)
localStorage.setItem('accessToken', token);
localStorage.setItem('refreshToken', refreshToken);

// ✅ Opción 2: sessionStorage (se borra al cerrar pestaña)
sessionStorage.setItem('accessToken', token);
sessionStorage.setItem('refreshToken', refreshToken);

// ✅ Opción 3: Cookies accesibles desde JavaScript
document.cookie = `accessToken=${token}; path=/; max-age=900; SameSite=Strict`;
document.cookie = `refreshToken=${refreshToken}; path=/; max-age=604800; SameSite=Strict`;

// ❌ NO usar httpOnly cookies si necesitas acceder desde JavaScript
// httpOnly previene acceso desde JavaScript (XSS protection)

// 🔍 **Comparación de Opciones de Almacenamiento:**

// **localStorage:**
// ✅ Persistente entre sesiones
// ✅ Fácil acceso desde JavaScript
// ❌ Vulnerable a XSS
// ❌ No se borra automáticamente

// **sessionStorage:**
// ✅ Se borra al cerrar pestaña
// ✅ Fácil acceso desde JavaScript
// ❌ Vulnerable a XSS
// ❌ Se pierde al recargar página

// **Cookies JavaScript:**
// ✅ Configurables (expiración, dominio, path)
// ✅ Enviadas automáticamente en peticiones
// ✅ Accesibles desde JavaScript
// ❌ Vulnerable a XSS
// ❌ Límite de tamaño (4KB)

// **Cookies httpOnly:**
// ✅ Protección contra XSS
// ✅ Enviadas automáticamente
// ❌ NO accesibles desde JavaScript
// ❌ Requiere backend para manejo
```

#### **2. Validación de Tokens:**
```javascript
// Validar formato del token antes de usarlo
const isValidToken = (token) => {
  if (!token || typeof token !== 'string') return false;
  if (token.split('.').length !== 3) return false;
  return true;
};

// Usar solo si es válido
if (isValidToken(accessToken)) {
  config.headers.Authorization = `Bearer ${accessToken}`;
}
```

#### **3. Manejo de Errores:**
```javascript
// Manejar diferentes tipos de errores
const handleAuthError = (error) => {
  switch (error.response?.status) {
    case 401:
      // Token expirado o inválido
      if (error.response?.data?.message?.includes('expired')) {
        // Intentar refresh
        return refreshToken();
      }
      // Token inválido, hacer logout
      logout();
      break;
    case 403:
      // Usuario no tiene permisos
      showPermissionError();
      break;
    default:
      // Error genérico
      showGenericError();
  }
};
```

### **🍪 Implementación con Cookies JavaScript:**

```javascript
// Utilidades para manejar cookies
const CookieUtils = {
  // Establecer cookie
  setCookie: (name, value, days = 7) => {
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Strict`;
  },

  // Obtener cookie
  getCookie: (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  },

  // Eliminar cookie
  deleteCookie: (name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  },

  // Establecer access token (15 minutos)
  setAccessToken: (token) => {
    CookieUtils.setCookie('accessToken', token, 0.01); // 15 minutos
  },

  // Establecer refresh token (7 días)
  setRefreshToken: (token) => {
    CookieUtils.setCookie('refreshToken', token, 7);
  }
};

// Uso en el interceptor de Axios
api.interceptors.request.use((config) => {
  const token = CookieUtils.getCookie('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Uso en el interceptor de respuesta
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = CookieUtils.getCookie('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }
        
        const response = await api.post('/auth/refresh-token', {
          token: refreshToken
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        // Actualizar cookies
        CookieUtils.setAccessToken(accessToken);
        CookieUtils.setRefreshToken(newRefreshToken);
        
        // Reintentar la petición original
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
        
      } catch (refreshError) {
        // Refresh falló, limpiar cookies y redirigir a login
        CookieUtils.deleteCookie('accessToken');
        CookieUtils.deleteCookie('refreshToken');
        
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);
```

### **📱 Implementación en React Native:**

```javascript
// Para React Native, usar AsyncStorage en lugar de localStorage
import AsyncStorage from '@react-native-async-storage/async-storage';

const storeTokens = async (accessToken, refreshToken) => {
  try {
    await AsyncStorage.multiSet([
      ['accessToken', accessToken],
      ['refreshToken', refreshToken]
    ]);
  } catch (error) {
    console.error('Error storing tokens:', error);
  }
};

const getTokens = async () => {
  try {
    const [accessToken, refreshToken] = await AsyncStorage.multiGet([
      'accessToken', 
      'refreshToken'
    ]);
    return {
      accessToken: accessToken[1],
      refreshToken: refreshToken[1]
    };
  } catch (error) {
    console.error('Error getting tokens:', error);
    return { accessToken: null, refreshToken: null };
  }
};
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
