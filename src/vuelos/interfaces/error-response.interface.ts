/**
 * Interfaz para respuestas de error estandarizadas
 */
export interface ErrorResponse {
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
 * Interfaz para errores específicos de Amadeus
 */
export interface AmadeusErrorDetails {
  source: 'amadeus';
  endpoint: string;
  method: string;
  statusCode: number;
  amadeusErrors: Array<{
    code: string;
    title: string;
    detail: string;
    source?: {
      parameter?: string;
      pointer?: string;
    };
  }>;
  requestData?: any;
  responseData?: any;
}

/**
 * Interfaz para errores internos del sistema
 */
export interface InternalErrorDetails {
  source: 'internal';
  service: string;
  method: string;
  originalError: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, any>;
}

/**
 * Interfaz para errores de validación
 */
export interface ValidationErrorDetails {
  source: 'validation';
  field: string;
  value: any;
  constraint: string;
  message: string;
}

/**
 * Interfaz para errores de red
 */
export interface NetworkErrorDetails {
  source: 'network';
  url: string;
  method: string;
  timeout?: boolean;
  connectionError?: boolean;
  statusCode?: number;
}

/**
 * Unión de todos los tipos de errores
 */
export type ErrorDetails = 
  | AmadeusErrorDetails 
  | InternalErrorDetails 
  | ValidationErrorDetails 
  | NetworkErrorDetails;

/**
 * Interfaz para el contexto de logging
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  endpoint: string;
  method: string;
  timestamp: string;
  duration?: number;
  userAgent?: string;
  ipAddress?: string;
}
