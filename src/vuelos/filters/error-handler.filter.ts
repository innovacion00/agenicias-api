import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorHandlerService } from '../services/error-handler.service';
import { ErrorResponse } from '../interfaces/error-response.interface';

// Extender la interfaz Request para incluir requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Filtro global para el manejo de excepciones
 */
@Catch()
export class ErrorHandlerFilter implements ExceptionFilter {
  private readonly logger = new Logger(ErrorHandlerFilter.name);

  constructor(private readonly errorHandlerService: ErrorHandlerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.requestId || this.generateRequestId();
    const timestamp = new Date().toISOString();

    let errorResponse: ErrorResponse;
    let statusCode: number;

    if (exception instanceof HttpException) {
      // Error ya manejado por el sistema
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'object' && 'success' in exceptionResponse) {
        // Ya es un ErrorResponse personalizado
        errorResponse = exceptionResponse as ErrorResponse;
      } else {
        // Convertir HttpException estándar a ErrorResponse
        errorResponse = {
          success: false,
          error: {
            code: this.getHttpExceptionCode(exception),
            message: this.getHttpExceptionMessage(exception),
            details: this.getHttpExceptionDetails(exception),
            timestamp,
            requestId,
            source: 'internal',
            statusCode
          }
        };
      }
    } else {
      // Error no manejado
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        error: {
          code: 'UNHANDLED_ERROR',
          message: 'Error interno del servidor',
          details: exception instanceof Error ? exception.message : 'Error desconocido',
          timestamp,
          requestId,
          source: 'internal',
          statusCode
        }
      };
    }

    // Log del error final
    this.logger.error(`[FILTER_ERROR] ${request.method} ${request.url}`, {
      requestId,
      statusCode,
      errorCode: errorResponse.error.code,
      errorMessage: errorResponse.error.message,
      errorSource: errorResponse.error.source,
      timestamp,
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip || request.connection.remoteAddress,
      url: request.url,
      method: request.method
    });

    // Enviar respuesta al cliente
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Obtiene el código de error para HttpException
   */
  private getHttpExceptionCode(exception: HttpException): string {
    const status = exception.getStatus();
    
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.METHOD_NOT_ALLOWED:
        return 'METHOD_NOT_ALLOWED';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'VALIDATION_ERROR';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_SERVER_ERROR';
      case HttpStatus.BAD_GATEWAY:
        return 'BAD_GATEWAY';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'SERVICE_UNAVAILABLE';
      case HttpStatus.GATEWAY_TIMEOUT:
        return 'GATEWAY_TIMEOUT';
      default:
        return 'UNKNOWN_ERROR';
    }
  }

  /**
   * Obtiene el mensaje de error para HttpException
   */
  private getHttpExceptionMessage(exception: HttpException): string {
    const response = exception.getResponse();
    
    if (typeof response === 'string') {
      return response;
    }
    
    if (typeof response === 'object' && response !== null) {
      if ('message' in response) {
        return Array.isArray(response.message) 
          ? response.message.join(', ') 
          : String(response.message);
      }
    }
    
    return 'Error en la solicitud';
  }

  /**
   * Obtiene los detalles del error para HttpException
   */
  private getHttpExceptionDetails(exception: HttpException): string | undefined {
    const response = exception.getResponse();
    
    if (typeof response === 'object' && response !== null) {
      if ('details' in response) {
        return String(response.details);
      }
      if ('error' in response) {
        return String(response.error);
      }
    }
    
    return undefined;
  }

  /**
   * Genera un ID único para la solicitud
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
