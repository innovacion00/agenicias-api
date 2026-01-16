import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import axios from 'axios';
import { envs } from 'src/config';

interface Attachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

@Injectable()
export class SendEmailCustomService {
  constructor() {}

  private logger = new Logger(SendEmailCustomService.name);
  private cachedAccessToken: string | null = null;
  private tokenExpiryTime: number | null = null;

  /**
   * Convierte un Buffer a base64url (formato requerido por Gmail API)
   */
  private bufferToBase64Url(buffer: Buffer): string {
    return buffer
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  /**
   * Construye el mensaje en formato RFC 2822 con mejores prácticas anti-spam
   */
  private buildRfc2822Message(
    from: string,
    to: string | string[],
    subject: string,
    html: string,
    attachments?: Attachment[],
  ): string {
    const toEmails = Array.isArray(to) ? to.join(', ') : to;
    const messageId = `<${Date.now()}-${Math.random().toString(36)}@gehsuites.com>`;
    const date = new Date().toUTCString();
    
    // Construir headers básicos con mejores prácticas anti-spam
    let message = `From: "Geh Suites" <${from}>\r\n`;
    message += `To: ${toEmails}\r\n`;
    message += `Subject: ${subject}\r\n`;
    message += `Date: ${date}\r\n`;
    message += `Message-ID: ${messageId}\r\n`;
    message += `MIME-Version: 1.0\r\n`;
    
    // Headers anti-spam importantes
    message += `X-Mailer: Geh Suites API\r\n`;
    message += `X-Priority: 3\r\n`; // Prioridad normal
    message += `Precedence: bulk\r\n`; // Indica que es correo masivo/transaccional
    message += `Auto-Submitted: auto-generated\r\n`; // Indica que es generado automáticamente
    
    // Headers de identificación
    message += `Reply-To: ${from}\r\n`;
    message += `Return-Path: ${from}\r\n`;
    
    // Headers de organización
    message += `Organization: Geh Suites\r\n`;
    message += `X-Entity-Ref-ID: ${Date.now()}\r\n`; // ID único para tracking
    
    // Limpiar y normalizar el HTML (eliminar espacios extra y saltos de línea innecesarios)
    const cleanHtml = html.trim().replace(/\r\n/g, '\n').replace(/\n\s*\n/g, '\n');
    
    // Si hay attachments, usar multipart/mixed
    if (attachments && attachments.length > 0) {
      const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      message += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
      message += `Content-Transfer-Encoding: 7bit\r\n\r\n`;
      
      // Parte del HTML (usar base64 para mejor compatibilidad)
      message += `--${boundary}\r\n`;
      message += `Content-Type: text/html; charset=UTF-8\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n\r\n`;
      const htmlBase64 = Buffer.from(cleanHtml, 'utf8').toString('base64');
      const htmlBase64Lines = htmlBase64.match(/.{1,76}/g) || [];
      message += htmlBase64Lines.join('\r\n') + '\r\n\r\n';
      
      // Agregar archivos adjuntos
      attachments.forEach((attachment) => {
        message += `--${boundary}\r\n`;
        message += `Content-Type: ${attachment.contentType}; name="${attachment.filename}"\r\n`;
        message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
        message += `Content-Transfer-Encoding: base64\r\n\r\n`;
        // Dividir base64 en líneas de 76 caracteres (RFC 2045)
        const base64Content = attachment.content.toString('base64');
        const base64Lines = base64Content.match(/.{1,76}/g) || [];
        message += base64Lines.join('\r\n') + '\r\n';
      });
      
      message += `--${boundary}--\r\n`;
    } else {
      // Sin attachments, mensaje simple HTML (usar base64 para mejor compatibilidad)
      message += `Content-Type: text/html; charset=UTF-8\r\n`;
      message += `Content-Transfer-Encoding: base64\r\n\r\n`;
      const htmlBase64 = Buffer.from(cleanHtml, 'utf8').toString('base64');
      const htmlBase64Lines = htmlBase64.match(/.{1,76}/g) || [];
      message += htmlBase64Lines.join('\r\n') + '\r\n';
    }
    
    return message;
  }

  /**
   * Obtiene el userId de Gmail desde el email
   */
  private getGmailUserId(email: string): string {
    // Para Gmail API, el userId puede ser 'me' si es la cuenta autenticada
    // o el email completo si se usa con un servicio account
    // IMPORTANTE: El refresh token debe estar asociado a la misma cuenta que SENDER_EMAIL
    this.logger.debug(`Usando userId 'me' para la cuenta: ${email}`);
    return 'me';
  }

  /**
   * Refresca el Access Token usando el Refresh Token
   */
  private async refreshAccessToken(): Promise<string> {
    try {
      this.logger.log('Refrescando Access Token de Gmail API...');

      // Validar que las variables estén configuradas
      if (!envs.googleGmailClientId || !envs.googleGmailClientSecret || !envs.googleGmailRefreshToken) {
        throw new Error(
          'Variables de entorno faltantes: GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET o GOOGLE_GMAIL_REFRESH_TOKEN',
        );
      }

      // Limpiar y validar el refresh token (eliminar espacios, saltos de línea, etc.)
      let refreshToken = envs.googleGmailRefreshToken.trim();
      
      // Eliminar cualquier carácter de nueva línea o retorno de carro que pueda haber
      refreshToken = refreshToken.replace(/\r?\n/g, '').replace(/\s+/g, '');
      
      // Validar formato básico (debe comenzar con "1//")
      if (!refreshToken || refreshToken.length < 10) {
        this.logger.error(`Refresh Token inválido: length=${refreshToken?.length || 0}`);
        throw new Error('GOOGLE_GMAIL_REFRESH_TOKEN no es válido o está vacío');
      }
      
      if (!refreshToken.startsWith('1//')) {
        this.logger.warn(`Refresh Token no tiene el formato esperado. Primeros caracteres: ${refreshToken.substring(0, 10)}`);
      }

      // Logging detallado para debugging (usar log en lugar de debug para ver siempre)
      this.logger.log(`[DEBUG] Client ID: ${envs.googleGmailClientId?.substring(0, 30) || 'NO DEFINIDO'}...`);
      this.logger.log(`[DEBUG] Client Secret: ${envs.googleGmailClientSecret?.substring(0, 10) || 'NO DEFINIDO'}...`);
      this.logger.log(`[DEBUG] Refresh Token (primeros 30 chars): ${refreshToken.substring(0, 30)}...`);
      this.logger.log(`[DEBUG] Refresh Token length: ${refreshToken.length} caracteres`);
      this.logger.log(`[DEBUG] Refresh Token completo: ${refreshToken}`);

      const tokenUrl = 'https://oauth2.googleapis.com/token';
      
      const params = new URLSearchParams({
        client_id: envs.googleGmailClientId.trim(),
        client_secret: envs.googleGmailClientSecret.trim(),
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      });

      this.logger.debug(`Enviando petición a: ${tokenUrl}`);

      const response = await axios.post(tokenUrl, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      const { access_token, expires_in } = response.data;

      if (!access_token) {
        throw new Error('No se recibió access_token en la respuesta');
      }

      // Cachear el token y su tiempo de expiración (restar 5 minutos como margen de seguridad)
      this.cachedAccessToken = access_token;
      this.tokenExpiryTime = Date.now() + (expires_in - 300) * 1000; // expires_in está en segundos

      this.logger.log('Access Token refrescado exitosamente');
      this.logger.debug(`Token expira en: ${expires_in} segundos`);

      return access_token;
    } catch (error) {
      this.logger.error('Error al refrescar Access Token:', error);
      if (error.response) {
        this.logger.error(`Status: ${error.response.status}`);
        this.logger.error(`Respuesta: ${JSON.stringify(error.response.data, null, 2)}`);
        
        // Mensajes más específicos según el error
        if (error.response.data?.error === 'invalid_grant') {
          this.logger.error('⚠️  El refresh token es inválido o ha sido revocado');
          this.logger.error('⚠️  Posibles causas:');
          this.logger.error('   1. El refresh token no está configurado correctamente en GOOGLE_GMAIL_REFRESH_TOKEN');
          this.logger.error('   2. El refresh token fue revocado en Google Cloud Console');
          this.logger.error('   3. El refresh token tiene espacios o caracteres extra');
          this.logger.error('   4. Necesitas generar un nuevo refresh token');
        }
      }
      throw new InternalServerErrorException(
        `Error al refrescar token de Gmail API: ${error.message || 'Error desconocido'}`,
      );
    }
  }

  /**
   * Obtiene un Access Token válido (usa cache o refresca si es necesario)
   */
  private async getValidAccessToken(): Promise<string> {
    // Si tenemos un token en cache y no ha expirado, usarlo
    if (this.cachedAccessToken && this.tokenExpiryTime && Date.now() < this.tokenExpiryTime) {
      this.logger.debug('Usando Access Token en cache');
      return this.cachedAccessToken;
    }

    // Si no hay token o expiró, intentar refrescar
    try {
      return await this.refreshAccessToken();
    } catch (error) {
      // Si falla el refresh, intentar usar el token de las variables de entorno como fallback
      if (envs.googleGmailApiKey) {
        this.logger.warn('Usando token de variables de entorno como fallback');
        return envs.googleGmailApiKey;
      }
      throw error;
    }
  }
  
  public async sendEmail(
    target: string | string[],
    subject: string,
    html: string,
    attachments?: Attachment[],
  ) {
    // Validar que las variables de entorno estén configuradas
    if (!envs.googleGmailApiKey || !envs.googleGmailUrl || 
        !envs.googleGmailClientId || !envs.googleGmailClientSecret || 
        !envs.googleGmailRefreshToken) {
      this.logger.error('Variables de entorno de Gmail API no configuradas');
      throw new InternalServerErrorException(
        'Configuración de Gmail API no encontrada. Verifique: GOOGLE_GMAIL_API_KEY, ' +
        'GOOGLE_GMAIL_URL, GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET y GOOGLE_GMAIL_REFRESH_TOKEN',
      );
    }

    if (!envs.senderEmail) {
      this.logger.error('SENDER_EMAIL no configurado');
      throw new InternalServerErrorException(
        'Configuración de email no encontrada. Verifique SENDER_EMAIL',
      );
    }

    this.logger.log(`Intentando enviar email a: ${Array.isArray(target) ? target.join(', ') : target}`);
    this.logger.log(`Asunto: ${subject}`);

    // Obtener el userId de Gmail
    const userId = this.getGmailUserId(envs.senderEmail);
    
    // Construir el mensaje en formato RFC 2822
    const rawMessage = this.buildRfc2822Message(
      envs.senderEmail,
      target,
      subject,
      html,
      attachments,
    );

    // Logging del mensaje (primeros 500 caracteres para debug)
    this.logger.debug(`Mensaje RFC 2822 (primeros 500 chars):\n${rawMessage.substring(0, 500)}...`);
    this.logger.log(`Remitente: ${envs.senderEmail}`);
    this.logger.log(`Destinatario: ${Array.isArray(target) ? target.join(', ') : target}`);

    // Convertir el mensaje a base64url
    const encodedMessage = this.bufferToBase64Url(Buffer.from(rawMessage));

    // Construir la URL de la API de Gmail (asegurar que tenga protocolo)
    let baseUrl = envs.googleGmailUrl.trim();
    if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
      baseUrl = `https://${baseUrl}`;
    }
    // Eliminar barra final si existe
    baseUrl = baseUrl.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/gmail/v1/users/${userId}/messages/send`;

    // Preparar el payload
    const payload = {
      raw: encodedMessage,
    };

    try {

      // Obtener un Access Token válido (refresca automáticamente si es necesario)
      const accessToken = await this.getValidAccessToken();

      // Configurar headers
      const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      };

      this.logger.log(`Enviando email a través de Gmail API: ${apiUrl}`);
      this.logger.debug(`Token length: ${accessToken.length} caracteres`);

      // Verificar el perfil de la cuenta antes de enviar (para debugging)
      try {
        const profileUrl = `${baseUrl}/gmail/v1/users/me/profile`;
        const profileResponse = await axios.get(profileUrl, { headers });
        this.logger.log(`Cuenta Gmail autenticada: ${profileResponse.data.emailAddress}`);
        
        // Verificar que el remitente coincida con la cuenta autenticada
        if (profileResponse.data.emailAddress && profileResponse.data.emailAddress !== envs.senderEmail) {
          this.logger.warn(
            `⚠️ ADVERTENCIA: El remitente configurado (${envs.senderEmail}) no coincide con la cuenta autenticada (${profileResponse.data.emailAddress}). ` +
            `Esto puede causar que los correos no se envíen correctamente.`
          );
        }
      } catch (profileError) {
        this.logger.warn('No se pudo verificar el perfil de la cuenta (no crítico)');
      }

      // Enviar el email usando la API de Gmail
      const response = await axios.post(apiUrl, payload, { headers });

      this.logger.log(`Email enviado exitosamente. MessageId: ${response.data.id}`);
      this.logger.log(`Respuesta de Gmail API: ${JSON.stringify(response.data)}`);

      return {
        messageId: response.data.id,
        threadId: response.data.threadId,
        labelIds: response.data.labelIds,
      };
    } catch (error) {
      this.logger.error('Error al enviar email:', error);
      this.logger.error(`Detalles del error: ${error.message}`);
      
      if (error.response) {
        const errorData = error.response.data;
        this.logger.error(`Respuesta de Gmail API: ${JSON.stringify(errorData, null, 2)}`);
        this.logger.error(`Status: ${error.response.status}`);
        
        // Mensajes específicos para errores comunes
        if (error.response.status === 401) {
          const errorMessage = errorData?.error?.message || 'Token inválido o expirado';
          
          // Si el token falló, limpiar cache e intentar refrescar
          this.cachedAccessToken = null;
          this.tokenExpiryTime = null;
          
          // Intentar refrescar el token y reintentar una vez
          try {
            this.logger.log('Token expirado, intentando refrescar...');
            const newToken = await this.refreshAccessToken();
            
            // Reintentar con el nuevo token
            const retryHeaders = {
              'Authorization': `Bearer ${newToken}`,
              'Content-Type': 'application/json',
            };
            
            this.logger.log('Reintentando envío con nuevo token...');
            const retryResponse = await axios.post(apiUrl, payload, { headers: retryHeaders });
            
            this.logger.log(`Email enviado exitosamente después de refrescar token. MessageId: ${retryResponse.data.id}`);
            return {
              messageId: retryResponse.data.id,
              threadId: retryResponse.data.threadId,
              labelIds: retryResponse.data.labelIds,
            };
          } catch (retryError) {
            this.logger.error('Error al reintentar después de refrescar token:', retryError);
            throw new InternalServerErrorException(
              `Error de autenticación con Gmail API: ${errorMessage}. ` +
              `Verifica que GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET y ` +
              `GOOGLE_GMAIL_REFRESH_TOKEN estén configurados correctamente.`,
            );
          }
        }
        
        if (error.response.status === 403) {
          throw new InternalServerErrorException(
            `Error de permisos con Gmail API: ${errorData?.error?.message || 'Sin permisos'}. ` +
            `Verifica que el token tenga el scope 'https://www.googleapis.com/auth/gmail.send'.`,
          );
        }
      }
      
      if (error.code) {
        this.logger.error(`Código de error: ${error.code}`);
      }

      throw new InternalServerErrorException(
        `Error en las notificaciones por email: ${error.message || 'Error desconocido'}`,
      );
    }
  }
}
