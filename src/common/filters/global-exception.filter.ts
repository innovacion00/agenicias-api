import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';

/**
 * Request de Express enriquecido por pino-http: `id` lo asigna el middleware
 * de nestjs-pino usando `genReqId` (configurado en `app.module.ts` como
 * `randomUUID()`), y es el correlationId real de la petición.
 */
type RequestConId = Request & { id?: string | number };

/** Forma mínima de un error de clave duplicada de Mongo (code 11000). */
interface ErrorDuplicadoMongo {
  code: number;
  keyValue: Record<string, unknown>;
}

/** Forma mínima de un AxiosError (sin depender del paquete axios). */
interface ErrorAxios {
  isAxiosError: boolean;
  message?: string;
  response?: { status?: number; data?: unknown };
  config?: { method?: string; url?: string };
}

/**
 * Filtro global de excepciones (PR-2.3) en modo SUPERSET-COMPATIBLE:
 *
 * - NUNCA cambia `statusCode` ni `message` respecto a lo que el cliente ve
 *   hoy (Nest estándar / ErrorManager). Solo AÑADE `correlationId`,
 *   `timestamp` y `path` a la raíz de la respuesta.
 * - HttpException: passthrough de `getResponse()` (el `message: string[]`
 *   del ValidationPipe queda idéntico, como array).
 * - Mongo `code === 11000`: réplica exacta del mapeo de ErrorManager
 *   (400 + `"{...} existente en BD"`) más `details.duplicateKey`.
 * - Cualquier otro error (incluido AxiosError): 500 con `message:
 *   'Revisar logs'` (idéntico a ErrorManager). El stack y, si aplica, el
 *   payload del tercero van SOLO al log con el mismo correlationId.
 *   El mapeo AxiosError -> 502 queda explícitamente fuera de la Fase 2.
 *
 * Convivencia: el filtro de `VuelosController` está aplicado con
 * `@UseFilters` a nivel de controller y gana por precedencia de Nest, por lo
 * que las rutas de vuelos conservan su formato `{ success: false, ... }`.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<RequestConId>();

    // correlationId real: req.id lo asigna pino-http (genReqId -> randomUUID).
    // El fallback solo aplica si el middleware de pino no corrió (p. ej. tests).
    const correlationId = String(request?.id ?? randomUUID());
    const timestamp = new Date().toISOString();
    const path = request?.originalUrl ?? request?.url ?? '';

    let statusCode: number;
    let body: Record<string, unknown>;

    if (exception instanceof HttpException) {
      // Passthrough total: ni statusCode ni message cambian.
      statusCode = exception.getStatus();
      const respuesta = exception.getResponse();
      body =
        typeof respuesta === 'object' && respuesta !== null
          ? { ...(respuesta as Record<string, unknown>) }
          : { statusCode, message: respuesta };
    } else if (this.esErrorDuplicadoMongo(exception)) {
      // Réplica exacta del mapeo de ErrorManager para clave duplicada.
      statusCode = HttpStatus.BAD_REQUEST;
      body = {
        statusCode,
        message: `${JSON.stringify(exception.keyValue)} existente en BD`,
        error: 'Bad Request',
        details: { duplicateKey: exception.keyValue },
      };
    } else {
      // Error desconocido (incluye AxiosError no atrapado): réplica de
      // ErrorManager. El detalle real va SOLO al log, nunca al cliente.
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      body = {
        statusCode,
        message: 'Revisar logs',
        error: 'Internal Server Error',
      };
    }

    // Todo 5xx se loguea con stack y el mismo correlationId de la respuesta.
    if (statusCode >= 500) {
      this.logErrorInterno(exception, request, statusCode, correlationId);
    }

    response.status(statusCode).json({
      ...body,
      correlationId,
      timestamp,
      path,
    });
  }

  private logErrorInterno(
    exception: unknown,
    request: RequestConId,
    statusCode: number,
    correlationId: string,
  ): void {
    const mensaje =
      exception instanceof Error ? exception.message : String(exception);
    const stack = exception instanceof Error ? exception.stack : undefined;

    this.logger.error(
      `[correlationId=${correlationId}] ${request?.method ?? ''} ${
        request?.originalUrl ?? request?.url ?? ''
      } -> ${statusCode} :: ${mensaje}`,
      stack,
    );

    // Si es un AxiosError, el payload del tercero va SOLO al log.
    if (this.esErrorAxios(exception)) {
      this.logger.error(
        `[correlationId=${correlationId}] Respuesta del tercero (AxiosError ${
          exception.response?.status ?? 'sin status'
        } ${exception.config?.url ?? ''}): ${JSON.stringify(
          exception.response?.data,
        )}`,
      );
    }
  }

  private esErrorDuplicadoMongo(
    exception: unknown,
  ): exception is ErrorDuplicadoMongo {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as ErrorDuplicadoMongo).code === 11000
    );
  }

  private esErrorAxios(exception: unknown): exception is ErrorAxios {
    return (
      typeof exception === 'object' &&
      exception !== null &&
      (exception as ErrorAxios).isAxiosError === true
    );
  }
}
