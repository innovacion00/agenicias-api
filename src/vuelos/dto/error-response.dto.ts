import { ErrorResponse } from '../interfaces/error-response.interface';

/**
 * DTO para respuestas de error estandarizadas
 */
export class ErrorResponseDto implements ErrorResponse {
  success: false;

  error: {
    code: string;
    message: string;
    details?: string;
    timestamp: string;
    requestId?: string;
    source: 'internal' | 'amadeus' | 'validation' | 'network';
    statusCode: number;
  };

  data?: any;
}

/**
 * DTO para errores de Amadeus específicos
 */
export class AmadeusErrorResponseDto extends ErrorResponseDto {
  data: {
    amadeusErrors: Array<{
      code: string;
      title: string;
      detail: string;
      source?: {
        parameter?: string;
        pointer?: string;
      };
    }>;
    endpoint: string;
    method: string;
  };
}

/**
 * DTO para errores de validación
 */
export class ValidationErrorResponseDto extends ErrorResponseDto {
  data: {
    field: string;
    value: any;
    constraint: string;
    message: string;
  };
}
