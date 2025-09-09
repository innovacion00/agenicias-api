import { ApiProperty } from '@nestjs/swagger';
import { ErrorResponse } from '../interfaces/error-response.interface';

/**
 * DTO para respuestas de error estandarizadas
 */
export class ErrorResponseDto implements ErrorResponse {
  @ApiProperty({
    description: 'Indica si la operación fue exitosa',
    example: false,
  })
  success: false;

  @ApiProperty({
    description: 'Información detallada del error',
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Código único del error',
        example: 'AMADEUS_AUTHENTICATION_FAILED',
      },
      message: {
        type: 'string',
        description: 'Mensaje descriptivo del error',
        example: 'Error de autenticación con Amadeus',
      },
      details: {
        type: 'string',
        description: 'Detalles adicionales del error',
        example: 'Credenciales inválidas o token expirado',
      },
      timestamp: {
        type: 'string',
        description: 'Timestamp del error en formato ISO',
        example: '2024-01-15T10:30:00.000Z',
      },
      requestId: {
        type: 'string',
        description: 'ID único de la solicitud para tracking',
        example: 'req_123456789',
      },
      source: {
        type: 'string',
        enum: ['internal', 'amadeus', 'validation', 'network'],
        description: 'Fuente del error',
        example: 'amadeus',
      },
      statusCode: {
        type: 'number',
        description: 'Código de estado HTTP',
        example: 401,
      },
    },
  })
  error: {
    code: string;
    message: string;
    details?: string;
    timestamp: string;
    requestId?: string;
    source: 'internal' | 'amadeus' | 'validation' | 'network';
    statusCode: number;
  };

  @ApiProperty({
    description: 'Datos adicionales relacionados con el error',
    required: false,
  })
  data?: any;
}

/**
 * DTO para errores de Amadeus específicos
 */
export class AmadeusErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Detalles específicos del error de Amadeus',
    type: 'object',
    properties: {
      amadeusErrors: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            code: { type: 'string' },
            title: { type: 'string' },
            detail: { type: 'string' },
            source: {
              type: 'object',
              properties: {
                parameter: { type: 'string' },
                pointer: { type: 'string' },
              },
            },
          },
        },
      },
      endpoint: { type: 'string' },
      method: { type: 'string' },
    },
  })
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
  @ApiProperty({
    description: 'Detalles del error de validación',
    type: 'object',
    properties: {
      field: { type: 'string' },
      value: { type: 'string' },
      constraint: { type: 'string' },
      message: { type: 'string' },
    },
  })
  data: {
    field: string;
    value: any;
    constraint: string;
    message: string;
  };
}
