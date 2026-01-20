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
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/createPackage`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      if (info) {
        queryParams.append('info', info);
      }

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de creación de paquete: ${url}`);

      // Preparar el body (solo flightId, currency, language y webhook - sin hotel)
      const requestBody = {
        flightId: createPackageDto.flightId,
        ...(createPackageDto.currency && { currency: createPackageDto.currency }),
        ...(createPackageDto.language && { language: createPackageDto.language }),
        ...(createPackageDto.webhook && { webhook: createPackageDto.webhook }),
      };

      this.logger.debug(`Body de la petición: ${JSON.stringify(requestBody)}`);

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
      this.logger.error('Error al crear paquete de vuelo en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de creación de paquete inválidos',
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
        `Error al crear paquete de vuelo: ${error.message}`,
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
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Eliminar barra final si existe
      baseUrl = baseUrl.replace(/\/$/, '');
      
      // Construir la URL con el endpoint
      const endpoint = `${baseUrl}/getLuggage/`;

      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('packageId', packageId);

      const url = `${endpoint}?${queryParams.toString()}`;

      this.logger.debug(`URL de consulta de equipaje: ${url}`);

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
      this.logger.error('Error al consultar equipaje en MaarLab:', error.response?.data || error.message);
      
      if (error instanceof AxiosError) {
        if (error.response?.status === 401) {
          throw new HttpException(
            'Token de autenticación de MaarLab inválido. Verifica MAARLAB_AUTH_TOKEN.',
            HttpStatus.UNAUTHORIZED,
          );
        }
        
        if (error.response?.status === 400) {
          throw new HttpException(
            error.response.data?.message || 'Parámetros de consulta de equipaje inválidos',
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
}
