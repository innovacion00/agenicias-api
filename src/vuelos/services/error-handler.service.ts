import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { AxiosError } from 'axios';
import {
  ErrorResponse,
  AmadeusErrorDetails,
  InternalErrorDetails,
  ValidationErrorDetails,
  NetworkErrorDetails,
  LogContext,
} from '../interfaces/error-response.interface';

/**
 * Servicio centralizado para el manejo de errores
 */
@Injectable()
export class ErrorHandlerService {
  private readonly logger = new Logger(ErrorHandlerService.name);

  /**
   * Genera un ID único para la solicitud
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Maneja errores de Amadeus
   */
  handleAmadeusError(
    error: AxiosError,
    context: LogContext,
    endpoint: string,
    method: string,
    requestData?: any,
  ): HttpException {
    const requestId = context.requestId || this.generateRequestId();
    const timestamp = new Date().toISOString();

    const amadeusError: AmadeusErrorDetails = {
      source: 'amadeus',
      endpoint,
      method,
      statusCode: error.response?.status || 500,
      amadeusErrors: (error.response?.data as any)?.errors || [],
      requestData,
      responseData: error.response?.data,
    };

    // Log detallado del error de Amadeus
    this.logger.error(`[AMADEUS_ERROR] ${endpoint} ${method}`, {
      requestId,
      timestamp,
      statusCode: amadeusError.statusCode,
      endpoint,
      method,
      amadeusErrors: amadeusError.amadeusErrors,
      requestData: requestData ? JSON.stringify(requestData, null, 2) : 'N/A',
      responseData: amadeusError.responseData
        ? JSON.stringify(amadeusError.responseData, null, 2)
        : 'N/A',
      context,
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: this.getAmadeusErrorCode(
          amadeusError.statusCode,
          amadeusError.amadeusErrors,
        ),
        message: this.getAmadeusErrorMessage(
          amadeusError.statusCode,
          amadeusError.amadeusErrors,
        ),
        details: this.getAmadeusErrorDetails(amadeusError.amadeusErrors),
        timestamp,
        requestId,
        source: 'amadeus',
        statusCode: amadeusError.statusCode,
      },
      data: {
        amadeusErrors: amadeusError.amadeusErrors,
        endpoint,
        method,
      },
    };

    return new HttpException(errorResponse, amadeusError.statusCode);
  }

  /**
   * Maneja errores internos del sistema
   */
  handleInternalError(
    error: Error,
    context: LogContext,
    service: string,
    method: string,
    additionalContext?: Record<string, any>,
  ): HttpException {
    const requestId = context.requestId || this.generateRequestId();
    const timestamp = new Date().toISOString();

    const internalError: InternalErrorDetails = {
      source: 'internal',
      service,
      method,
      originalError: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context: additionalContext,
    };

    // Log detallado del error interno
    this.logger.error(`[INTERNAL_ERROR] ${service}.${method}`, {
      requestId,
      timestamp,
      service,
      method,
      errorName: internalError.originalError.name,
      errorMessage: internalError.originalError.message,
      stack: internalError.originalError.stack,
      additionalContext,
      context,
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: this.getInternalErrorCode(error),
        message: this.getInternalErrorMessage(error),
        details: this.getInternalErrorDetails(error),
        timestamp,
        requestId,
        source: 'internal',
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      },
      data: {
        service,
        method,
        originalError: {
          name: internalError.originalError.name,
          message: internalError.originalError.message,
        },
      },
    };

    return new HttpException(errorResponse, HttpStatus.INTERNAL_SERVER_ERROR);
  }

  /**
   * Maneja errores de validación
   */
  handleValidationError(
    field: string,
    value: any,
    constraint: string,
    message: string,
    context: LogContext,
  ): HttpException {
    const requestId = context.requestId || this.generateRequestId();
    const timestamp = new Date().toISOString();

    const _validationError: ValidationErrorDetails = {
      source: 'validation',
      field,
      value,
      constraint,
      message,
    };

    // Log del error de validación
    this.logger.warn(`[VALIDATION_ERROR] ${field}`, {
      requestId,
      timestamp,
      field,
      value,
      constraint,
      message,
      context,
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Error de validación en los datos de entrada',
        details: message,
        timestamp,
        requestId,
        source: 'validation',
        statusCode: HttpStatus.BAD_REQUEST,
      },
      data: {
        field,
        value,
        constraint,
        message,
      },
    };

    return new HttpException(errorResponse, HttpStatus.BAD_REQUEST);
  }

  /**
   * Maneja errores de red
   */
  handleNetworkError(
    error: Error,
    context: LogContext,
    url: string,
    method: string,
    timeout?: boolean,
  ): HttpException {
    const requestId = context.requestId || this.generateRequestId();
    const timestamp = new Date().toISOString();

    const networkError: NetworkErrorDetails = {
      source: 'network',
      url,
      method,
      timeout: timeout || false,
      connectionError: !timeout,
    };

    // Log del error de red
    this.logger.error(`[NETWORK_ERROR] ${method} ${url}`, {
      requestId,
      timestamp,
      url,
      method,
      timeout,
      connectionError: networkError.connectionError,
      errorMessage: error.message,
      context,
    });

    const errorResponse: ErrorResponse = {
      success: false,
      error: {
        code: timeout ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR',
        message: timeout ? 'Timeout de conexión' : 'Error de conexión de red',
        details: error.message,
        timestamp,
        requestId,
        source: 'network',
        statusCode: timeout
          ? HttpStatus.REQUEST_TIMEOUT
          : HttpStatus.BAD_GATEWAY,
      },
      data: {
        url,
        method,
        timeout,
        connectionError: networkError.connectionError,
      },
    };

    return new HttpException(
      errorResponse,
      timeout ? HttpStatus.REQUEST_TIMEOUT : HttpStatus.BAD_GATEWAY,
    );
  }

  /**
   * Obtiene el código de error específico para errores de Amadeus
   */
  private getAmadeusErrorCode(
    statusCode: number,
    amadeusErrors: Array<{ code?: string; title?: string; detail?: string }>,
  ): string {
    if (statusCode === 401) return 'AMADEUS_AUTHENTICATION_FAILED';
    if (statusCode === 403) return 'AMADEUS_FORBIDDEN';
    if (statusCode === 404) return 'AMADEUS_NOT_FOUND';
    if (statusCode === 400) return 'AMADEUS_BAD_REQUEST';
    if (statusCode === 422) return 'AMADEUS_VALIDATION_ERROR';
    if (statusCode === 429) return 'AMADEUS_RATE_LIMIT_EXCEEDED';
    if (statusCode >= 500) return 'AMADEUS_SERVER_ERROR';

    // Si hay errores específicos de Amadeus, usar el primer código
    if (amadeusErrors && amadeusErrors.length > 0) {
      return `AMADEUS_${amadeusErrors[0].code || 'UNKNOWN_ERROR'}`;
    }

    return 'AMADEUS_UNKNOWN_ERROR';
  }

  /**
   * Obtiene el mensaje de error para errores de Amadeus
   */
  private getAmadeusErrorMessage(
    statusCode: number,
    amadeusErrors: Array<{ code?: string; title?: string; detail?: string }>,
  ): string {
    if (statusCode === 401) return 'Error de autenticación con Amadeus';
    if (statusCode === 403) return 'Acceso denegado por Amadeus';
    if (statusCode === 404) return 'Recurso no encontrado en Amadeus';
    if (statusCode === 400) return 'Solicitud inválida a Amadeus';
    if (statusCode === 422) return 'Error de validación en Amadeus';
    if (statusCode === 429) return 'Límite de solicitudes excedido en Amadeus';
    if (statusCode >= 500) return 'Error interno del servidor de Amadeus';

    // Si hay errores específicos de Amadeus, usar el primer mensaje
    if (amadeusErrors && amadeusErrors.length > 0) {
      return amadeusErrors[0].title || 'Error desconocido de Amadeus';
    }

    return 'Error desconocido de Amadeus';
  }

  /**
   * Obtiene los detalles del error de Amadeus
   */
  private getAmadeusErrorDetails(
    amadeusErrors: Array<{ code?: string; title?: string; detail?: string }>,
  ): string {
    if (!amadeusErrors || amadeusErrors.length === 0) {
      return 'No se proporcionaron detalles del error';
    }

    return amadeusErrors.map((error) => error.detail).join('; ');
  }

  /**
   * Obtiene el código de error para errores internos
   */
  private getInternalErrorCode(error: Error): string {
    if (error.name === 'ValidationError') return 'VALIDATION_ERROR';
    if (error.name === 'TypeError') return 'TYPE_ERROR';
    if (error.name === 'ReferenceError') return 'REFERENCE_ERROR';
    if (error.name === 'SyntaxError') return 'SYNTAX_ERROR';
    if (error.message.includes('timeout')) return 'TIMEOUT_ERROR';
    if (error.message.includes('connection')) return 'CONNECTION_ERROR';

    return 'INTERNAL_SERVER_ERROR';
  }

  /**
   * Obtiene el mensaje de error para errores internos
   */
  private getInternalErrorMessage(error: Error): string {
    if (error.name === 'ValidationError') return 'Error de validación de datos';
    if (error.name === 'TypeError') return 'Error de tipo de datos';
    if (error.name === 'ReferenceError') return 'Error de referencia';
    if (error.name === 'SyntaxError') return 'Error de sintaxis';
    if (error.message.includes('timeout')) return 'Timeout en la operación';
    if (error.message.includes('connection')) return 'Error de conexión';

    return 'Error interno del servidor';
  }

  /**
   * Obtiene los detalles del error interno
   */
  private getInternalErrorDetails(error: Error): string {
    return `Error: ${error.name} - ${error.message}`;
  }

  /**
   * Log de operación exitosa
   */
  logSuccess(context: LogContext, message: string, data?: any): void {
    this.logger.log(`[SUCCESS] ${message}`, {
      requestId: context.requestId,
      timestamp: context.timestamp,
      endpoint: context.endpoint,
      method: context.method,
      duration: context.duration,
      data,
    });
  }

  /**
   * Log de operación con advertencia
   */
  logWarning(context: LogContext, message: string, data?: any): void {
    this.logger.warn(`[WARNING] ${message}`, {
      requestId: context.requestId,
      timestamp: context.timestamp,
      endpoint: context.endpoint,
      method: context.method,
      data,
    });
  }
}
