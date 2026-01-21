import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { envs } from '../config';
import { MaarLabFlightSearchDto } from './dto/maarlab-flight-search.dto';

@Injectable()
export class MaarLabService {
  private readonly logger = new Logger(MaarLabService.name);

  /**
   * Busca vuelos disponibles usando la API de MaarLab Oceanflights
   * @param searchDto - Parámetros de búsqueda de vuelos
   * @returns Respuesta con ofertas de vuelos disponibles
   */
  async searchFlights(searchDto: MaarLabFlightSearchDto): Promise<any> {
    try {
      this.logger.log('Iniciando búsqueda de vuelos en MaarLab...');
      this.logger.debug(`Parámetros de búsqueda: ${JSON.stringify(searchDto)}`);

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint y parámetros
      // Formato: https://test-api.maarlab.online/api/v1/searchForFlightsToDestination/?origin=MAD&departureDate=...
      const endpoint = `${baseUrl}/searchForFlightsToDestination/`;

      // Construir query parameters en el orden correcto
      const queryParams = new URLSearchParams();
      
      // Parámetros requeridos (en el orden que muestra el ejemplo)
      queryParams.append('origin', searchDto.origin);
      queryParams.append('departureDate', searchDto.departureDate);
      
      // returnDate antes de adults (según el ejemplo)
      if (searchDto.returnDate) {
        queryParams.append('returnDate', searchDto.returnDate);
      }
      
      queryParams.append('adults', searchDto.adults.toString());
      queryParams.append('destination', searchDto.destination);
      queryParams.append('currency', searchDto.currency);

      // Parámetros opcionales
      if (searchDto.ages && searchDto.ages.length > 0) {
        searchDto.ages.forEach(age => {
          queryParams.append('ages', age.toString());
        });
      }

      if (searchDto.canarian_resident !== undefined) {
        queryParams.append('canarian_resident', searchDto.canarian_resident.toString());
      }

      if (searchDto.balear_resident !== undefined) {
        queryParams.append('balear_resident', searchDto.balear_resident.toString());
      }

      if (searchDto.ceuta_melilla_resident !== undefined) {
        queryParams.append('ceuta_melilla_resident', searchDto.ceuta_melilla_resident.toString());
      }

      if (searchDto.search_mode) {
        queryParams.append('search_mode', searchDto.search_mode);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de búsqueda: ${url}`);

      // Realizar la petición
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Búsqueda de vuelos completada exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al buscar vuelos en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de búsqueda inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado. Verifica MAARLAB_BASE_URL.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al buscar vuelos: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crea un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param createPackageDto - Datos para crear el paquete
   * @param info - Nivel de detalle de la respuesta ('all' para información completa)
   * @returns Respuesta con información del paquete creado
   */
  async createPackage(createPackageDto: any, info: string = 'all'): Promise<any> {
    try {
      this.logger.log('Iniciando creación de paquete de vuelo en MaarLab...');
      this.logger.debug(`Parámetros de creación: ${JSON.stringify(createPackageDto)}`);

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      this.logger.debug(`MAARLAB_BASE_URL original: ${baseUrl}`);
      
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      this.logger.debug(`Base URL después de limpiar: ${baseUrl}`);
      
      // Construir la URL con el endpoint (con barra final según documentación MaarLab)
      const endpoint = `${baseUrl}/createPackage/`;
      this.logger.debug(`Endpoint construido: ${endpoint}`);

      // Construir query parameters
      const queryParams = new URLSearchParams();
      if (info) {
        queryParams.append('info', info);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL completa de creación de paquete: ${url}`);
      this.logger.debug(`URL esperada: https://test-api.oceanflights.io/api/v1/createPackage/?info=${info}`);

      // Preparar el body
      // MaarLab requiere hotel y services, siempre se envían vacíos
      const requestBody: any = {
        flightId: createPackageDto.flightId,
        hotel: {}, // Siempre vacío según requerimiento
        services: {}, // Siempre vacío según requerimiento
      };

      // Agregar campos opcionales solo si están presentes
      if (createPackageDto.currency) {
        requestBody.currency = createPackageDto.currency;
      }
      if (createPackageDto.language) {
        requestBody.language = createPackageDto.language;
      }

      this.logger.debug(`URL completa: ${url}`);
      this.logger.debug(`Body de la petición: ${JSON.stringify(requestBody, null, 2)}`);
      this.logger.debug(`Headers: Authorization: Bearer ${envs.maarlabAuthToken ? '***' : 'NO CONFIGURADO'}`);

      // Realizar la petición POST
      const response: AxiosResponse = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Paquete de vuelo creado exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      // Log detallado del error
      if (error instanceof AxiosError) {
        const errorDetails = {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
          requestBody: error.config?.data ? (typeof error.config.data === 'string' ? JSON.parse(error.config.data) : error.config.data) : null,
        };
        
        this.logger.error('Error detallado de MaarLab al crear paquete:');
        this.logger.error(JSON.stringify(errorDetails, null, 2));

        if (error.response?.status === 401) {
          throw new HttpException(
            {
              message: 'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
              maarLabError: error.response.data,
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          const maarLabMessage = error.response.data?.message || error.response.data?.error || JSON.stringify(error.response.data);
          throw new HttpException(
            {
              message: 'Parámetros de creación de paquete inválidos',
              maarLabError: error.response.data,
              maarLabMessage,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 422) {
          const maarLabResponse = error.response.data;
          const maarLabMessage = maarLabResponse?.message || maarLabResponse?.error || maarLabResponse?.detail || JSON.stringify(maarLabResponse);
          const requestBodySent = error.config?.data ? (typeof error.config.data === 'string' ? JSON.parse(error.config.data) : error.config.data) : null;
          
          this.logger.error('Error 422 de MaarLab - Detalles de validación:');
          this.logger.error(`MaarLab Response: ${JSON.stringify(maarLabResponse, null, 2)}`);
          this.logger.error(`Request Body Sent: ${JSON.stringify(requestBodySent, null, 2)}`);
          this.logger.error(`URL: ${error.config?.url}`);
          
          throw new HttpException(
            {
              message: 'Error de validación en MaarLab. Verifica los datos enviados.',
              maarLabError: maarLabResponse,
              maarLabMessage,
              maarLabResponse: maarLabResponse, // Incluir respuesta completa
              requestBody: requestBodySent,
            },
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
        
        if (error.response?.status === 404) {
          // Verificar si el error es sobre un recurso específico (Flight ID, Package ID, etc.)
          // o si es realmente un endpoint no encontrado
          const maarLabMessage = error.response.data?.errors?.message || 
                                 error.response.data?.message || 
                                 error.response.data?.detail || 
                                 JSON.stringify(error.response.data);
          
          // Si el mensaje contiene "not found" o "no encontrado", es un recurso no encontrado
          const isResourceNotFound = maarLabMessage.toLowerCase().includes('not found') || 
                                    maarLabMessage.toLowerCase().includes('no encontrado');
          
          const errorMessage = isResourceNotFound 
            ? maarLabMessage 
            : 'Endpoint no encontrado. Verifica MAARLAB_BASE_URL.';
          
          throw new HttpException(
            {
              message: errorMessage,
              maarLabError: error.response.data,
              maarLabMessage,
              url: error.config?.url,
            },
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            {
              message: 'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
              maarLabError: error.response.data,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            {
              message: 'Error interno del servidor de MaarLab. Intenta más tarde.',
              maarLabError: error.response.data,
            },
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      this.logger.error('Error al crear paquete de vuelo en MaarLab:', error.message);
      throw new HttpException(
        {
          message: `Error al crear paquete de vuelo: ${error.message}`,
          error: error instanceof Error ? error.stack : error,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene información de equipaje disponible para un paquete usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete obtenido después de su creación
   * @returns Respuesta con información de equipaje disponible
   */
  async getLuggage(packageId: string): Promise<any> {
    try {
      this.logger.log('Iniciando consulta de equipaje en MaarLab...');
      this.logger.debug(`Package ID: ${packageId}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      this.logger.debug(`MAARLAB_BASE_URL original: ${baseUrl}`);
      
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      this.logger.debug(`Base URL después de limpiar: ${baseUrl}`);
      
      // Construir la URL con el endpoint (getLuggages con 's' según documentación MaarLab)
      const endpoint = `${baseUrl}/getLuggages/`;
      this.logger.debug(`Endpoint construido: ${endpoint}`);

      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('packageId', packageId);

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL completa de consulta de equipaje: ${url}`);

      // Realizar la petición GET
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Consulta de equipaje completada exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
       // Log detallado del error
      if (error instanceof AxiosError) {
        this.logger.error('Error detallado de MaarLab al consultar equipaje:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
          packageId,
        });
        
        if (error.response?.status === 401) {
          throw new HttpException(
            {
              message: 'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
              maarLabError: error.response.data,
            },
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            {
              message: error.response.data?.message || 'Parámetros de consulta de equipaje inválidos',
              maarLabError: error.response.data,
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          // Verificar si el error es sobre un recurso específico (Package ID) o si es realmente un endpoint no encontrado
          const maarLabMessage = error.response.data?.errors?.message || 
                                 error.response.data?.message || 
                                 error.response.data?.detail || 
                                 JSON.stringify(error.response.data);
          
          // Si el mensaje contiene "not found" o "no encontrado", es un recurso no encontrado
          const isResourceNotFound = maarLabMessage.toLowerCase().includes('not found') || 
                                    maarLabMessage.toLowerCase().includes('no encontrado');
          
          const errorMessage = isResourceNotFound 
            ? maarLabMessage 
            : 'Endpoint no encontrado. Verifica MAARLAB_BASE_URL.';
          
          throw new HttpException(
            {
              message: errorMessage,
              maarLabError: error.response.data,
              maarLabMessage,
              url: error.config?.url,
              packageId,
            },
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al consultar equipaje: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Agrega extras seleccionados a un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete obtenido después de su creación
   * @param extrasData - Datos de los extras a agregar
   * @param info - Nivel de detalle de la respuesta ('all' para información completa)
   * @returns Respuesta con información del paquete actualizado
   */
  async addExtras(packageId: string, extrasData: any, info: string = 'all'): Promise<any> {
    try {
      this.logger.log('Iniciando agregado de extras en MaarLab...');
      this.logger.debug(`Package ID: ${packageId}, Info: ${info}`);
      this.logger.debug(`Extras data: ${JSON.stringify(extrasData)}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/addExtras`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('packageId', packageId);
      if (info) {
        queryParams.append('info', info);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de agregado de extras: ${url}`);

      // Realizar la petición POST
      const response: AxiosResponse = await axios.post(url, extrasData, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Extras agregados exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al agregar extras en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de agregado de extras inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado o paquete no existe. Verifica MAARLAB_BASE_URL y el packageId.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al agregar extras: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Elimina un extra específico de un paquete usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete del cual se elimina el extra
   * @param itemId - ID del item a eliminar
   * @param typeExtraId - ID del tipo de extra a eliminar
   * @param info - Nivel de detalle de la respuesta ('all' para información completa)
   * @returns Respuesta con información del paquete actualizado
   */
  async deleteExtras(
    packageId: string,
    itemId: number,
    typeExtraId: number,
    info: string = 'all'
  ): Promise<any> {
    try {
      this.logger.log('Iniciando eliminación de extra en MaarLab...');
      this.logger.debug(`Package ID: ${packageId}, Item ID: ${itemId}, Type Extra ID: ${typeExtraId}, Info: ${info}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/deleteExtras/`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('packageId', packageId);
      queryParams.append('itemId', itemId.toString());
      queryParams.append('typeExtraId', typeExtraId.toString());
      if (info) {
        queryParams.append('info', info);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de eliminación de extra: ${url}`);

      // Realizar la petición DELETE
      const response: AxiosResponse = await axios.delete(url, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Extra eliminado exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al eliminar extra en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de eliminación de extra inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado o paquete/extra no existe. Verifica MAARLAB_BASE_URL y los parámetros.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al eliminar extra: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Reserva un paquete de vuelo agregando información de pasajeros usando la API de MaarLab Oceanflights
   * @param bookPackageDto - Datos para reservar el paquete (pasajeros, pago, etc.)
   * @param info - Nivel de detalle de la respuesta ('all' para información completa)
   * @returns Respuesta con información de la reserva/prebooking
   */
  async bookPackage(bookPackageDto: any, info: string = 'all'): Promise<any> {
    try {
      this.logger.log('Iniciando reserva de paquete en MaarLab...');
      this.logger.debug(`Package ID: ${bookPackageDto.packageId}, Info: ${info}`);
      this.logger.debug(`Passengers: ${bookPackageDto.passengers?.length || 0}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/bookPackage/`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      if (info) {
        queryParams.append('info', info);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de reserva de paquete: ${url}`);

      // Preparar el body
      const requestBody = {
        packageId: bookPackageDto.packageId,
        ...(bookPackageDto.hotel_id && { hotel_id: bookPackageDto.hotel_id }),
        ...(bookPackageDto.partner_id && { partner_id: bookPackageDto.partner_id }),
        passengers: bookPackageDto.passengers,
        ...(bookPackageDto.payment && { payment: bookPackageDto.payment }),
      };

      this.logger.debug(`Body de la petición: ${JSON.stringify(requestBody).substring(0, 500)}...`);

      // Realizar la petición POST
      const response: AxiosResponse = await axios.post(url, requestBody, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Paquete reservado exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al reservar paquete en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de reserva de paquete inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado o paquete no existe. Verifica MAARLAB_BASE_URL y el packageId.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al reservar paquete: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene el token de pago para un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete para obtener el token de pago
   * @param paymentType - Tipo de pago (opcional)
   * @param deferredPaymentDate - Fecha de pago diferido (opcional, formato YYYY-MM-DD)
   * @returns Respuesta con el token de pago
   */
  async getTokenPayment(
    packageId: string,
    paymentType?: string,
    deferredPaymentDate?: string
  ): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de token de pago en MaarLab...');
      this.logger.debug(`Package ID: ${packageId}, Payment Type: ${paymentType}, Deferred Date: ${deferredPaymentDate}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/getTokenPayment/`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('packageId', packageId);
      
      if (paymentType) {
        queryParams.append('paymentType', paymentType);
      }
      
      if (deferredPaymentDate) {
        queryParams.append('deferredPaymentDate', deferredPaymentDate);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de obtención de token de pago: ${url}`);

      // Realizar la petición GET
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Token de pago obtenido exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al obtener token de pago en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de obtención de token de pago inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado o paquete no existe. Verifica MAARLAB_BASE_URL y el packageId.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al obtener token de pago: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene los detalles completos de un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete a obtener
   * @param info - Nivel de detalle de la respuesta ('all' para información completa)
   * @returns Respuesta con los detalles completos del paquete
   */
  async getPackage(packageId: string, info: string = 'all'): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de detalles de paquete en MaarLab...');
      this.logger.debug(`Package ID: ${packageId}, Info: ${info}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/getPackage`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('packageId', packageId);
      if (info) {
        queryParams.append('info', info);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de obtención de paquete: ${url}`);

      // Realizar la petición GET
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Detalles de paquete obtenidos exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al obtener detalles de paquete en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de obtención de paquete inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado o paquete no existe. Verifica MAARLAB_BASE_URL y el packageId.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al obtener detalles de paquete: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene el contrato de factura ATOL para un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete para obtener el contrato ATOL
   * @returns Respuesta con el contrato de factura ATOL
   */
  async getInvoiceATOLContract(packageId: string): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de contrato ATOL en MaarLab...');
      this.logger.debug(`Package ID: ${packageId}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/getInvoiceATOLContract`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('packageId', packageId);

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de obtención de contrato ATOL: ${url}`);

      // Realizar la petición GET
      const response: AxiosResponse = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Contrato ATOL obtenido exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al obtener contrato ATOL en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de obtención de contrato ATOL inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado o paquete no existe. Verifica MAARLAB_BASE_URL y el packageId.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al obtener contrato ATOL: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crea hoteles con configuración por defecto usando la API de MaarLab Oceanflights
   * @param completeProcessDto - Datos del hotel a crear
   * @returns Respuesta con información del hotel creado o actualizado
   */
  async searchEngineCompleteProcess(completeProcessDto: any): Promise<any> {
    try {
      this.logger.log('Iniciando creación de hotel en MaarLab...');
      this.logger.debug(`Hotel name: ${completeProcessDto.name}, External ID: ${completeProcessDto.external_id}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/search_engine/complete_process`;

      this.logger.debug(`URL de creación de hotel: ${endpoint}`);

      // Preparar el body con todos los campos
      const requestBody = {
        name: completeProcessDto.name,
        external_id: completeProcessDto.external_id,
        id_chain_search_engine: completeProcessDto.id_chain_search_engine,
        direction: completeProcessDto.direction,
        phone: completeProcessDto.phone,
        email: completeProcessDto.email,
        id_partner: completeProcessDto.id_partner,
        clasification: completeProcessDto.clasification,
        currency_code: completeProcessDto.currency_code,
        post_code: completeProcessDto.post_code,
        city: completeProcessDto.city,
        country: completeProcessDto.country,
        website: completeProcessDto.website,
        hours_of_operation: completeProcessDto.hours_of_operation,
        cif: completeProcessDto.cif,
        registered_company_name: completeProcessDto.registered_company_name,
        contact_center_type: completeProcessDto.contact_center_type,
        account_manager_name: completeProcessDto.account_manager_name,
        account_manager_email: completeProcessDto.account_manager_email,
        ...(completeProcessDto.description && { description: completeProcessDto.description }),
        ...(completeProcessDto.account_manager_phone && { account_manager_phone: completeProcessDto.account_manager_phone }),
        ...(completeProcessDto.prefix_locator && { prefix_locator: completeProcessDto.prefix_locator }),
      };

      this.logger.debug(`Body de la petición: ${JSON.stringify(requestBody).substring(0, 500)}...`);

      // Realizar la petición POST
      const response: AxiosResponse = await axios.post(endpoint, requestBody, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Hotel creado/actualizado exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al crear/actualizar hotel en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de creación de hotel inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado. Verifica MAARLAB_BASE_URL y que la cadena de hoteles y el partner hayan sido creados previamente.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al crear/actualizar hotel: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Crea agencias de viajes con configuración por defecto usando la API de MaarLab Oceanflights
   * @param completeProcessDto - Datos de la agencia de viajes a crear
   * @returns Respuesta con información de la agencia de viajes creada o actualizada
   */
  async travelAgencyCompleteProcess(completeProcessDto: any): Promise<any> {
    try {
      this.logger.log('Iniciando creación de agencia de viajes en MaarLab...');
      this.logger.debug(`Agency name: ${completeProcessDto.name}, External ID: ${completeProcessDto.external_id}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/travel_agency/complete_process`;

      this.logger.debug(`URL de creación de agencia de viajes: ${endpoint}`);

      // Preparar el body con todos los campos
      const requestBody = {
        name: completeProcessDto.name,
        external_id: completeProcessDto.external_id,
        id_chain_search_engine: completeProcessDto.id_chain_search_engine,
        direction: completeProcessDto.direction,
        phone: completeProcessDto.phone,
        email: completeProcessDto.email,
        id_partner: completeProcessDto.id_partner,
        clasification: completeProcessDto.clasification,
        currency_code: completeProcessDto.currency_code,
        post_code: completeProcessDto.post_code,
        city: completeProcessDto.city,
        country: completeProcessDto.country,
        website: completeProcessDto.website,
        hours_of_operation: completeProcessDto.hours_of_operation,
        cif: completeProcessDto.cif,
        registered_company_name: completeProcessDto.registered_company_name,
        contact_center_type: completeProcessDto.contact_center_type,
        account_manager_name: completeProcessDto.account_manager_name,
        account_manager_email: completeProcessDto.account_manager_email,
        ...(completeProcessDto.description && { description: completeProcessDto.description }),
        ...(completeProcessDto.account_manager_phone && { account_manager_phone: completeProcessDto.account_manager_phone }),
        ...(completeProcessDto.prefix_locator && { prefix_locator: completeProcessDto.prefix_locator }),
      };

      this.logger.debug(`Body de la petición: ${JSON.stringify(requestBody).substring(0, 500)}...`);

      // Realizar la petición POST
      const response: AxiosResponse = await axios.post(endpoint, requestBody, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('Agencia de viajes creada/actualizada exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al crear/actualizar agencia de viajes en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de creación de agencia de viajes inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado. Verifica MAARLAB_BASE_URL y que la cadena de hoteles y el partner hayan sido creados previamente.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al crear/actualizar agencia de viajes: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Obtiene el external ID de un hotel desde el ID interno de Oceanflight usando la API de MaarLab Oceanflights
   * @param idSearchEngine - ID interno del search engine (Oceanflight)
   * @returns Respuesta con el external ID del hotel
   */
  async mappingExternalIdSearchEngine(idSearchEngine: string): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de external ID en MaarLab...');
      this.logger.debug(`ID Search Engine: ${idSearchEngine}`);

      // Validar que las variables de entorno estén configuradas
      if (!envs.maarlabBaseUrl || !envs.maarlabAuthToken) {
        throw new HttpException(
          'Configuración de MaarLab incompleta. Verifica MAARLAB_BASE_URL y MAARLAB_AUTH_TOKEN.',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Construir la URL base
      let baseUrl = envs.maarlabBaseUrl.trim();
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint (path parameter)
      const endpoint = `${baseUrl}/search_engine/mapping-external-id/${idSearchEngine}/`;

      this.logger.debug(`URL de obtención de external ID: ${endpoint}`);

      // Realizar la petición GET
      const response: AxiosResponse = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${envs.maarlabAuthToken}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 segundos de timeout
      });

      this.logger.log('External ID obtenido exitosamente');
      this.logger.debug(`Respuesta recibida: ${JSON.stringify(response.data).substring(0, 500)}...`);

      return response.data;
    } catch (error) {
      this.logger.error('Error al obtener external ID en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de obtención de external ID inválidos',
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (error.response?.status === 404) {
          throw new HttpException(
            'Endpoint no encontrado o search engine no existe. Verifica MAARLAB_BASE_URL y el id_search_engine.',
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (error.response?.status === 429) {
          throw new HttpException(
            'Límite de solicitudes excedido en MaarLab. Intenta más tarde.',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        if (error.response?.status && error.response.status >= 500) {
          throw new HttpException(
            'Error interno del servidor de MaarLab. Intenta más tarde.',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }

      throw new HttpException(
        `Error al obtener external ID: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
