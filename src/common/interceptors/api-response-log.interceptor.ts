import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

@Injectable()
export class ApiResponseLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ApiResponse');

  private esAuditable(url: string): boolean {
    if (url.includes('api-docs') || url.includes('favicon')) return false;
    if (url === '/health' || url.includes('/health')) return false;
    return true;
  }

  private recortar(valor: any, max = 3000): string {
    if (valor === undefined || valor === null) return '';
    let texto: string;
    try {
      texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
    } catch {
      texto = String(valor);
    }
    if (texto.length > max) return `${texto.slice(0, max)} …(truncado)`;
    return texto;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const url = `${req.method} ${req.originalUrl || req.url}`;
    if (!this.esAuditable(url)) return next.handle();

    return next.handle().pipe(
      map((body) => {
        this.logger.log(`[api →] ${url} → 200: ${this.recortar(body)}`);
        return body;
      }),
      catchError((err: any) => {
        if (err instanceof HttpException) {
          const status = err.getStatus();
          this.logger.error(
            `[api →] ${url} → ERROR ${status}: ${this.recortar(err.getResponse())}`,
          );
        } else {
          this.logger.error(
            `[api →] ${url} → ERROR ${HttpStatus.INTERNAL_SERVER_ERROR}: ${this.recortar(err?.message)}`,
          );
        }
        return throwError(() => err);
      }),
    );
  }
}