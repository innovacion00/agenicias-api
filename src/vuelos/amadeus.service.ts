import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { envs } from '../config';
import { AMADEUS_CONSTANTS } from '../config/constants';
import {
  AmadeusLocationResponse,
  AmadeusLocationQueryParams,
  AmadeusErrorResponse,
  AmadeusFlightOffersRequest,
  AmadeusFlightOffersResponse,
  AmadeusFlightOffersErrorResponse
} from './interfaces';

@Injectable()
export class AmadeusService {
  private readonly logger = new Logger(AmadeusService.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private readonly configService: ConfigService,
  ) {}

  /**
   * Obtiene un token de acceso de Amadeus usando OAuth2 Client Credentials Grant
   */
  private async getAccessToken(): Promise<string> {
    const now = Date.now();
    
    // Si el token aún es válido, lo retornamos
    if (this.accessToken && now < this.tokenExpiry) {
      this.logger.debug('Usando token de Amadeus existente');
      return this.accessToken;
    }

    try {
      // Construir la URL base correctamente, asegurando que tenga https:// y removiendo versiones duplicadas
      let baseUrl = envs.amadeusBaseUrl;
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Remover /v1 o /v2 del final si existe, ya que lo agregamos explícitamente
      baseUrl = baseUrl.replace(/\/v[0-9]+$/, '');
      
      const tokenUrl = `${baseUrl}/v1/security/oauth2/token`;
      
      this.logger.debug(`URL de autenticación construida: ${tokenUrl}`);
      
      // Crear el body en formato x-www-form-urlencoded según la documentación de Amadeus
      const tokenData = new URLSearchParams();
      tokenData.append('grant_type', 'client_credentials');
      tokenData.append('client_id', envs.amadeusApiKey);
      tokenData.append('client_secret', envs.amadeusApiSecret);

      this.logger.log('Solicitando nuevo token de acceso a Amadeus...');

      const response = await axios.post(tokenUrl, tokenData.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000, // 10 segundos de timeout
      });

      // Validar la respuesta según la documentación de Amadeus
      if (!response.data.access_token || !response.data.expires_in) {
        throw new Error('Respuesta inválida del servidor de autenticación de Amadeus');
      }

      this.accessToken = response.data.access_token;
      // El token expira según expires_in, pero lo renovamos 5 minutos antes para seguridad
      this.tokenExpiry = now + (response.data.expires_in - 300) * 1000;

      this.logger.log(`Token de Amadeus obtenido exitosamente. Expira en ${response.data.expires_in} segundos`);
      this.logger.debug(`Tipo de token: ${response.data.token_type}, Estado: ${response.data.state}`);
      
      return this.accessToken;
    } catch (error) {
      this.logger.error('Error al obtener token de Amadeus:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new HttpException(
          'Credenciales de Amadeus inválidas. Verifica tu API Key y API Secret.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      
      if (error.response?.status === 429) {
        throw new HttpException(
          'Límite de solicitudes excedido en Amadeus. Intenta más tarde.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new HttpException(
        'Error al autenticarse con Amadeus: ' + (error.response?.data?.error_description || error.message),
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Realiza una llamada autenticada a la API de Amadeus con reintentos automáticos
   */
  private async makeAuthenticatedRequest<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    retryCount = 0,
  ): Promise<T> {
    const maxRetries = 2;
    
    try {
      const token = await this.getAccessToken();
      
      // Construir la URL base correctamente
      let baseUrl = envs.amadeusBaseUrl;
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = `https://${baseUrl}`;
      }
      // Remover /v1 o /v2 del final si existe
      baseUrl = baseUrl.replace(/\/v[0-9]+$/, '');
      
             // Para las APIs de referencia (locations), usar v1 según la documentación
       // Para Flight Offers, usar v2 según la documentación
       // Para otras APIs, usar v1
       const version = endpoint.includes('flight-offers') ? '/v2' : '/v1';
       const url = `${baseUrl}${version}${endpoint}`;

      this.logger.debug(`URL de API construida: ${url}`);
      this.logger.debug(`Llamada a Amadeus: ${endpoint}`, data);

      // Para peticiones GET, los parámetros van en la URL como query params
      // Para peticiones POST, los parámetros van en el body
      const config: any = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/vnd.amadeus+json',
        },
        timeout: 15000, // 15 segundos de timeout
      };

      if (method === 'GET' && data) {
        // Construir query string para peticiones GET
        const queryParams = new URLSearchParams();
        Object.entries(data).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            queryParams.append(key, String(value));
          }
        });
        config.url = `${url}?${queryParams.toString()}`;
      } else if (method === 'POST') {
        config.data = data;
        config.headers['Content-Type'] = 'application/vnd.amadeus+json';
      }

      const response = await axios(config);

      this.logger.debug(`Respuesta exitosa de Amadeus ${endpoint}: ${response.status}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Error en llamada a Amadeus ${endpoint}:`, {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      
      // Si el token expiró (401) y no hemos reintentado, renovar token y reintentar
      if (error.response?.status === 401 && retryCount < maxRetries) {
        this.logger.warn(`Token expirado, renovando y reintentando... (intento ${retryCount + 1})`);
        this.accessToken = null; // Forzar renovación del token
        this.tokenExpiry = 0;
        return this.makeAuthenticatedRequest(method, endpoint, data, retryCount + 1);
      }
      
      // Manejar errores específicos de Amadeus
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AmadeusErrorResponse>;
        
        if (axiosError.response?.status === 400) {
          throw new HttpException(
            {
              message: 'Parámetros de búsqueda inválidos',
              errors: axiosError.response.data?.errors,
              details: axiosError.response.data?.errors?.map(e => e.detail).join(', '),
            },
            HttpStatus.BAD_REQUEST,
          );
        }
        
        if (axiosError.response?.status === 404) {
          throw new HttpException(
            {
              message: 'No se encontraron resultados para la búsqueda',
              errors: axiosError.response.data?.errors,
            },
            HttpStatus.NOT_FOUND,
          );
        }
        
        if (axiosError.response?.status === 429) {
          throw new HttpException(
            {
              message: 'Límite de solicitudes excedido. Intenta más tarde.',
              errors: axiosError.response.data?.errors,
            },
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        
        // Otros errores de Amadeus
        throw new HttpException(
          {
            message: 'Error en la API de Amadeus',
            errors: axiosError.response?.data?.errors,
            details: axiosError.response?.data?.errors?.map(e => `${e.title}: ${e.detail}`).join(', '),
          },
          axiosError.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      // Error de red o timeout
      if (error.code === 'ECONNABORTED') {
        throw new HttpException(
          'Timeout al conectar con Amadeus. Intenta más tarde.',
          HttpStatus.REQUEST_TIMEOUT,
        );
      }

      throw new HttpException(
        'Error interno del servidor al conectar con Amadeus',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Prueba la autenticación con Amadeus (método público para testing)
   */
  async testAuthentication(): Promise<string> {
    return this.getAccessToken();
  }

  /**
   * Busca ubicaciones (aeropuertos y ciudades) en Amadeus
   */
  async searchLocations(params: AmadeusLocationQueryParams): Promise<AmadeusLocationResponse> {
    this.logger.log(`Buscando ubicaciones con keyword: ${params.keyword}`);
    
    return this.makeAuthenticatedRequest<AmadeusLocationResponse>(
      'GET',
      AMADEUS_CONSTANTS.ENDPOINTS.LOCATIONS,
      params,
    );
  }

  /**
   * Busca aeropuertos por código IATA
   */
  async searchAirportsByIata(iataCode: string): Promise<AmadeusLocationResponse> {
    this.logger.log(`Buscando aeropuerto por código IATA: ${iataCode}`);
    
    return this.searchLocations({
      keyword: iataCode,
      subType: AMADEUS_CONSTANTS.SUB_TYPES.AIRPORT,
      view: AMADEUS_CONSTANTS.VIEW_TYPES.FULL,
    });
  }

  /**
   * Busca ciudades por nombre
   */
  async searchCitiesByName(cityName: string, countryCode?: string): Promise<AmadeusLocationResponse> {
    this.logger.log(`Buscando ciudad: ${cityName}${countryCode ? ` en ${countryCode}` : ''}`);
    
    const params: AmadeusLocationQueryParams = {
      keyword: cityName,
      subType: AMADEUS_CONSTANTS.SUB_TYPES.CITY,
      view: AMADEUS_CONSTANTS.VIEW_TYPES.FULL,
    };

    if (countryCode) {
      params.countryCode = countryCode;
    }

    return this.searchLocations(params);
  }

  /**
   * Busca ofertas de vuelos usando la API de Amadeus Flight Offers
   * @param searchRequest - Parámetros de búsqueda de vuelos
   * @returns Respuesta con ofertas de vuelos disponibles
   */
  async searchFlightOffers(searchRequest: AmadeusFlightOffersRequest): Promise<AmadeusFlightOffersResponse> {
    try {
      this.logger.log(`Buscando ofertas de vuelos para ${searchRequest.originDestinations.length} ruta(s)`);
      
      // Transformar el request para Amadeus API
      const amadeusRequest = this.transformFlightSearchRequest(searchRequest);
      
      this.logger.log(`Request original: ${JSON.stringify(searchRequest, null, 2)}`);
      this.logger.log(`Request transformado para Amadeus: ${JSON.stringify(amadeusRequest, null, 2)}`);
      
      // Realizar la búsqueda
      const response = await this.makeAuthenticatedRequest<AmadeusFlightOffersResponse>(
        'POST',
        `${AMADEUS_CONSTANTS.ENDPOINTS.FLIGHT_OFFERS}`,
        amadeusRequest
      );

      this.logger.log(`Búsqueda exitosa: ${response.meta.count} ofertas encontradas`);
      return response;
    } catch (error) {
      this.logger.error('Error buscando ofertas de vuelos:', error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AmadeusFlightOffersErrorResponse>;
        
               if (axiosError.response?.status === 400) {
         // Para errores 400, devolver el error específico de Amadeus
         const amadeusError = axiosError.response.data;
         if (amadeusError && amadeusError.errors && amadeusError.errors.length > 0) {
           throw new HttpException(
             {
               message: 'Error en parámetros de búsqueda',
               errors: amadeusError.errors,
               details: amadeusError.errors.map(e => e.detail).join(', ')
             },
             HttpStatus.BAD_REQUEST
           );
         } else {
           throw new HttpException(
             'Error en parámetros de búsqueda: Parámetros inválidos',
             HttpStatus.BAD_REQUEST
           );
         }
       }
        
        if (axiosError.response?.status === 404) {
          throw new HttpException(
            'No se encontraron vuelos para los criterios especificados',
            HttpStatus.NOT_FOUND
          );
        }
        
        if (axiosError.response?.status === 429) {
          throw new HttpException(
            'Límite de consultas excedido. Intente más tarde',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }
      
      throw new HttpException(
        'Error interno del servidor al buscar vuelos',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Transforma el request de búsqueda al formato requerido por Amadeus
   * @param searchRequest - Request original del cliente
   * @returns Request formateado para Amadeus API
   */
  private transformFlightSearchRequest(searchRequest: any): any {
    const amadeusRequest: any = {
      currencyCode: searchRequest.currencyCode || 'USD',
      originDestinations: searchRequest.originDestinations.map(od => ({
        id: od.id,
        originLocationCode: od.originLocationCode,
        destinationLocationCode: od.destinationLocationCode,
        departureDateTimeRange: {
          date: od.departureDateTimeRange?.date || od.departureDate,
          time: od.departureDateTimeRange?.time || od.departureTime || '00:00:00'
        }
      })),
      travelers: searchRequest.travelers,
      sources: searchRequest.sources || ['GDS']
    };

    // Agregar criterios de búsqueda si existen
    if (searchRequest.searchCriteria) {
      amadeusRequest.searchCriteria = {
        maxFlightOffers: searchRequest.searchCriteria.maxFlightOffers || 50
      };

      // Agregar filtros de vuelo si existen
      if (searchRequest.searchCriteria.flightFilters) {
        const filters = searchRequest.searchCriteria.flightFilters as any;
        
        amadeusRequest.searchCriteria.flightFilters = {};

        // Filtros de cabina
        if (filters.cabinRestrictions && filters.cabinRestrictions.length > 0) {
          amadeusRequest.searchCriteria.flightFilters.cabinRestrictions = filters.cabinRestrictions;
        }

        // Filtros de aerolínea
        if (filters.excludedCarrierCodes || filters.includedCarrierCodes) {
          amadeusRequest.searchCriteria.flightFilters.carrierRestrictions = {
            excludedCarrierCodes: filters.excludedCarrierCodes,
            includedCarrierCodes: filters.includedCarrierCodes
          };
        }

        // Filtros de precio
        if (filters.minPrice || filters.maxPrice) {
          amadeusRequest.searchCriteria.flightFilters.priceRange = {
            min: filters.minPrice,
            max: filters.maxPrice,
            currency: searchRequest.currencyCode || 'USD'
          };
        }

        // Filtros de tiempo de salida
        if (filters.earliestDepartureTime || filters.latestDepartureTime) {
          amadeusRequest.searchCriteria.flightFilters.departureTimeRange = {
            earliestTime: filters.earliestDepartureTime,
            latestTime: filters.latestDepartureTime
          };
        }

        // Filtros de conexiones
        if (filters.maxNumberOfConnections !== undefined) {
          amadeusRequest.searchCriteria.flightFilters.connectionRestrictions = {
            maxNumberOfConnections: filters.maxNumberOfConnections
          };
        }
      }
    }

    return amadeusRequest;
  }
}
