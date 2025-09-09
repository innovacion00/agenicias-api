import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ErrorHandlerService } from '../services/error-handler.service';
import { LogContext } from '../interfaces/error-response.interface';

/**
 * Interceptor para el manejo centralizado de errores
 */
@Injectable()
export class ErrorHandlerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ErrorHandlerInterceptor.name);

  constructor(private readonly errorHandlerService: ErrorHandlerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // Crear contexto de logging
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      userId: request.user?.id,
      endpoint: request.route?.path || request.url,
      method: request.method,
      timestamp: new Date().toISOString(),
      userAgent: request.headers['user-agent'],
      ipAddress: request.ip || request.connection.remoteAddress
    };

    // Agregar el requestId al request para uso posterior
    request.requestId = logContext.requestId;

    const startTime = Date.now();

    return next.handle().pipe(
      catchError((error) => {
        const duration = Date.now() - startTime;
        logContext.duration = duration;

        // Log del error capturado
        this.logger.error(`[INTERCEPTOR_ERROR] ${logContext.method} ${logContext.endpoint}`, {
          requestId: logContext.requestId,
          error: error.message,
          stack: error.stack,
          duration,
          context: logContext
        });

        // Re-lanzar el error para que sea manejado por el filtro de excepciones global
        return throwError(() => error);
      })
    );
  }

  /**
   * Genera un ID único para la solicitud
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
