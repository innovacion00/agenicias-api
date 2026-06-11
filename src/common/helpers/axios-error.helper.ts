import { InternalServerErrorException, Logger } from '@nestjs/common';
import axios from 'axios';

/**
 * Manejador comun de errores de Axios para los clientes HTTP
 * (AutocoreClient, CobreClient). Helper puro: sin estado y sin
 * dependencias de features. Loguea el detalle con el logger del
 * cliente que lo invoca y SIEMPRE lanza InternalServerErrorException.
 */
export function axiosError(error: any, apiName: string, logger: Logger): void {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      logger.error(`Error de la API ${apiName}:`, error.response.data);
      throw new InternalServerErrorException(
        `La API ${apiName} retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
      );
    } else if (error.request) {
      logger.error(`Error de red o timeout API ${apiName}:`, error.message);
      throw new InternalServerErrorException(
        `No se recibió respuesta de la API ${apiName}. Verifique su conexión o tiempo de espera.`,
      );
    } else {
      logger.error('Error en la configuración de Axios:', error.message);
      throw new InternalServerErrorException(
        `Error en la configuración de la solicitud API ${apiName} : ${error.message}`,
      );
    }
  } else {
    logger.error(`Error desconocido API ${apiName}:`, error);
    throw new InternalServerErrorException(
      `Ocurrió un error desconocido al realizar la solicitud API ${apiName}.`,
    );
  }
}
