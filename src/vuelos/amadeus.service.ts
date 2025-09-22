import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosResponse, AxiosError } from 'axios';
import { envs } from '../config';
import { AMADEUS_CONSTANTS } from '../config/constants';
import { ErrorHandlerService } from './services/error-handler.service';
import { LogContext } from './interfaces/error-response.interface';
import {
  AmadeusLocationResponse,
  AmadeusLocationQueryParams,
  AmadeusErrorResponse,
  AmadeusFlightOffersRequest,
  AmadeusFlightOffersResponse,
  AmadeusFlightOffersErrorResponse,
  AmadeusFlightOrderRequest,
  AmadeusFlightOrderResponse,
  AmadeusFlightOrderErrorResponse
} from './interfaces';

@Injectable()
export class AmadeusService {
  private readonly logger = new Logger(AmadeusService.name);
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly errorHandlerService: ErrorHandlerService,
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
    method: 'GET' | 'POST' | 'DELETE',
    endpoint: string,
    data?: any,
    retryCount = 0,
  ): Promise<T> {
    const maxRetries = 2;
    const startTime = Date.now();
    
    // Crear contexto de logging
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint,
      method,
      timestamp: new Date().toISOString()
    };
    
    try {
      this.logger.log(`[AMADEUS_REQUEST] Iniciando ${method} ${endpoint}`, {
        requestId: logContext.requestId,
        endpoint,
        method,
        hasData: !!data,
        retryCount
      });

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

      this.logger.debug(`[AMADEUS_REQUEST] URL construida: ${url}`, {
        requestId: logContext.requestId,
        baseUrl,
        version,
        endpoint
      });

      // Para peticiones GET, los parámetros van en la URL como query params
      // Para peticiones POST, los parámetros van en el body
      const config: any = {
        method,
        url,
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept': 'application/vnd.amadeus+json',
        },
        timeout: 250000, 
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
      const duration = Date.now() - startTime;
      logContext.duration = duration;

      this.logger.log(`[AMADEUS_SUCCESS] ${method} ${endpoint} completado`, {
        requestId: logContext.requestId,
        statusCode: response.status,
        duration,
        responseSize: JSON.stringify(response.data).length
      });

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      logContext.duration = duration;
      
      // Si el token expiró (401) y no hemos reintentado, renovar token y reintentar
      if (axios.isAxiosError(error) && error.response?.status === 401 && retryCount < maxRetries) {
        this.logger.warn(`[AMADEUS_RETRY] Token expirado, renovando y reintentando... (intento ${retryCount + 1})`, {
          requestId: logContext.requestId,
          endpoint,
          method,
          retryCount: retryCount + 1
        });
        this.accessToken = null; // Forzar renovación del token
        this.tokenExpiry = 0;
        return this.makeAuthenticatedRequest(method, endpoint, data, retryCount + 1);
      }
      
      // Manejar errores específicos de Amadeus usando el ErrorHandlerService
      if (axios.isAxiosError(error)) {
        throw this.errorHandlerService.handleAmadeusError(
          error,
          logContext,
          endpoint,
          method,
          data
        );
      }

      // Error de red o timeout
      if (error.code === 'ECONNABORTED') {
        throw this.errorHandlerService.handleNetworkError(
          error,
          logContext,
          `${envs.amadeusBaseUrl}${endpoint}`,
          method,
          true // timeout
        );
      }

      // Error interno no manejado
      throw this.errorHandlerService.handleInternalError(
        error,
        logContext,
        'AmadeusService',
        'makeAuthenticatedRequest',
        { endpoint, method, data }
      );
    }
  }

  /**
   * Genera un ID único para la solicitud
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
   * Busca ciudades usando la API específica de ciudades de Amadeus
   * @param params - Parámetros de búsqueda de ciudades
   * @returns Lista de ciudades encontradas
   */
  async searchCities(params: {
    countryCode?: string;
    keyword: string;
    max?: number;
    include?: string[];
  }): Promise<any> {
    this.logger.log(`Buscando ciudades con keyword: ${params.keyword}${params.countryCode ? ` en ${params.countryCode}` : ''}`);
    
    const queryParams: any = {
      keyword: params.keyword,
    };

    if (params.countryCode) {
      queryParams.countryCode = params.countryCode;
    }

    if (params.max) {
      queryParams.max = params.max;
    }

    if (params.include && params.include.length > 0) {
      queryParams.include = params.include.join(',');
    }

    return this.makeAuthenticatedRequest<any>(
      'GET',
      '/reference-data/locations/cities',
      queryParams,
    );
  }

  /**
   * Busca ofertas de vuelos usando la API de Amadeus Flight Offers
   * @param searchRequest - Parámetros de búsqueda de vuelos
   * @returns Respuesta con ofertas de vuelos disponibles
   */
  async searchFlightOffers(searchRequest: AmadeusFlightOffersRequest): Promise<AmadeusFlightOffersResponse> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'searchFlightOffers',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    try {
      this.logger.log(`[FLIGHT_SEARCH] Iniciando búsqueda de ofertas de vuelos`, {
        requestId: logContext.requestId,
        originDestinations: searchRequest.originDestinations.length,
        travelers: searchRequest.travelers?.length || 0,
        currencyCode: searchRequest.currencyCode
      });
      
      // Transformar el request para Amadeus API
      const amadeusRequest = this.transformFlightSearchRequest(searchRequest);
      
      this.logger.debug(`[FLIGHT_SEARCH] Request transformado para Amadeus`, {
        requestId: logContext.requestId,
        originalRequest: {
          originDestinations: searchRequest.originDestinations.length,
          travelers: searchRequest.travelers?.length || 0,
          currencyCode: searchRequest.currencyCode
        },
        amadeusRequest: {
          originDestinations: amadeusRequest.originDestinations.length,
          travelers: amadeusRequest.travelers?.length || 0,
          currencyCode: amadeusRequest.currencyCode,
          sources: amadeusRequest.sources
        }
      });
      
      // Realizar la búsqueda
      const response = await this.makeAuthenticatedRequest<AmadeusFlightOffersResponse>(
        'POST',
        `${AMADEUS_CONSTANTS.ENDPOINTS.FLIGHT_OFFERS}`,
        amadeusRequest
      );

      this.logger.log(`[FLIGHT_SEARCH_SUCCESS] Búsqueda completada exitosamente`, {
        requestId: logContext.requestId,
        offersFound: response.meta.count,
        totalOffers: response.meta.count,
        currency: (response.meta as any)?.currency || 'N/A',
        searchDuration: (response.meta as any)?.searchDuration || 'N/A'
      });

      return response;
    } catch (error) {
      this.logger.error(`[FLIGHT_SEARCH_ERROR] Error en búsqueda de ofertas de vuelos`, {
        requestId: logContext.requestId,
        error: error.message,
        searchRequest: {
          originDestinations: searchRequest.originDestinations.length,
          travelers: searchRequest.travelers?.length || 0,
          currencyCode: searchRequest.currencyCode
        }
      });
      
      // Re-lanzar el error para que sea manejado por el sistema de errores
      throw error;
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

  /**
   * Crea una reserva de vuelo usando la API de Amadeus Flight Orders
   * @param orderRequest - Datos de la reserva de vuelo
   * @returns Respuesta con la confirmación de la reserva
   */
  async createFlightOrder(orderRequest: AmadeusFlightOrderRequest): Promise<AmadeusFlightOrderResponse> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'createFlightOrder',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    try {
      this.logger.log(`[FLIGHT_ORDER] Iniciando creación de reserva de vuelo`, {
        requestId: logContext.requestId,
        travelers: orderRequest.data.travelers.length,
        flightOffers: orderRequest.data.flightOffers.length,
        hasRemarks: !!orderRequest.data.remarks,
        hasContacts: !!orderRequest.data.contacts
      });
      
      // Validar que la estructura del request sea correcta
      this.validateFlightOrderRequest(orderRequest);
      
      this.logger.debug(`[FLIGHT_ORDER] Request de reserva validado`, {
        requestId: logContext.requestId,
        travelers: orderRequest.data.travelers.length,
        flightOffers: orderRequest.data.flightOffers.length,
        endpoint: AMADEUS_CONSTANTS.ENDPOINTS.FLIGHT_ORDERS
      });
      
      // Realizar la reserva
      const response = await this.makeAuthenticatedRequest<AmadeusFlightOrderResponse>(
        'POST',
        `${AMADEUS_CONSTANTS.ENDPOINTS.FLIGHT_ORDERS}`,
        orderRequest
      );

      this.logger.log(`[FLIGHT_ORDER_SUCCESS] Reserva creada exitosamente`, {
        requestId: logContext.requestId,
        orderId: response.data.id,
        travelers: response.data.travelers?.length || 0,
        flightOffers: response.data.flightOffers?.length || 0,
        status: response.data.type
      });

      return response;
    } catch (error) {
      this.logger.error(`[FLIGHT_ORDER_ERROR] Error creando reserva de vuelo`, {
        requestId: logContext.requestId,
        error: error.message,
        orderRequest: {
          travelers: orderRequest.data.travelers.length,
          flightOffers: orderRequest.data.flightOffers.length,
          hasRemarks: !!orderRequest.data.remarks,
          hasContacts: !!orderRequest.data.contacts
        }
      });
      
      // Re-lanzar el error para que sea manejado por el sistema de errores
      throw error;
    }
  }

  /**
   * Valida la estructura del request de reserva
   * @param orderRequest - Request a validar
   */
  private validateFlightOrderRequest(orderRequest: AmadeusFlightOrderRequest): void {
    if (!orderRequest.data) {
      throw new HttpException('Datos de reserva requeridos', HttpStatus.BAD_REQUEST);
    }

    if (!orderRequest.data.flightOffers || orderRequest.data.flightOffers.length === 0) {
      throw new HttpException('Al menos una oferta de vuelo es requerida', HttpStatus.BAD_REQUEST);
    }

    if (!orderRequest.data.travelers || orderRequest.data.travelers.length === 0) {
      throw new HttpException('Al menos un viajero es requerido', HttpStatus.BAD_REQUEST);
    }

    // Validar que cada viajero tenga la información requerida
    orderRequest.data.travelers.forEach((traveler, index) => {
      if (!traveler.id || !traveler.dateOfBirth || !traveler.name || !traveler.gender || !traveler.contact) {
        throw new HttpException(
          `Información incompleta del viajero ${index + 1}`,
          HttpStatus.BAD_REQUEST
        );
      }

      if (!traveler.contact.emailAddress || !traveler.contact.phones || traveler.contact.phones.length === 0) {
        throw new HttpException(
          `Información de contacto incompleta del viajero ${index + 1}`,
          HttpStatus.BAD_REQUEST
        );
      }
    });

    this.logger.log('Validación de request de reserva exitosa');
  }

  /**
   * Consulta una reserva de vuelo específica
   * @param flightOrderId - ID de la reserva de vuelo
   * @returns Información de la reserva
   */
  async getFlightOrder(flightOrderId: string): Promise<AmadeusFlightOrderResponse> {
    try {
      this.logger.log(`Consultando reserva de vuelo: ${flightOrderId}`);
      
      const response = await this.makeAuthenticatedRequest<AmadeusFlightOrderResponse>(
        'GET',
        `${AMADEUS_CONSTANTS.ENDPOINTS.FLIGHT_ORDERS}/${encodeURIComponent(flightOrderId)}`
      );

      this.logger.log(`Reserva consultada exitosamente: ${response.data.id}`);
      return response;
    } catch (error) {
      this.logger.error(`Error consultando reserva ${flightOrderId}:`, error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AmadeusFlightOrderErrorResponse>;
        
        if (axiosError.response?.status === 400) {
          const amadeusError = axiosError.response.data;
          if (amadeusError && amadeusError.errors && amadeusError.errors.length > 0) {
            throw new HttpException(
              {
                message: 'Error en consulta de reserva',
                errors: amadeusError.errors,
                details: amadeusError.errors.map(e => e.detail).join(', ')
              },
              HttpStatus.BAD_REQUEST
            );
          } else {
            throw new HttpException(
              'Error en consulta de reserva: Parámetros inválidos',
              HttpStatus.BAD_REQUEST
            );
          }
        }
        
        if (axiosError.response?.status === 404) {
          const amadeusError = axiosError.response.data;
          this.logger.error('Amadeus 404 error (consulta):', amadeusError);
          
          if (amadeusError && amadeusError.errors && amadeusError.errors.length > 0) {
            throw new HttpException(
              {
                message: 'Reserva de vuelo no encontrada',
                errors: amadeusError.errors,
                details: amadeusError.errors.map(e => e.detail).join(', ')
              },
              HttpStatus.NOT_FOUND
            );
          } else {
            throw new HttpException(
              'Reserva de vuelo no encontrada',
              HttpStatus.NOT_FOUND
            );
          }
        }
        
        if (axiosError.response?.status === 429) {
          throw new HttpException(
            'Límite de consultas excedido. Intente más tarde',
            HttpStatus.TOO_MANY_REQUESTS
          );
        }
      }
      
      throw new HttpException(
        'Error interno del servidor al consultar la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Cancela una reserva de vuelo específica
   * @param flightOrderId - ID de la reserva de vuelo a cancelar
   * @returns Confirmación de la cancelación
   */
  async cancelFlightOrder(flightOrderId: string): Promise<void> {
    try {
      this.logger.log(`Cancelando reserva de vuelo: ${flightOrderId}`);
      
      await this.makeAuthenticatedRequest<void>(
        'DELETE',
        `${AMADEUS_CONSTANTS.ENDPOINTS.FLIGHT_ORDERS}/${encodeURIComponent(flightOrderId)}`
      );

      this.logger.log(`Reserva cancelada exitosamente: ${flightOrderId}`);
    } catch (error) {
      this.logger.error(`Error cancelando reserva ${flightOrderId}:`, error);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError<AmadeusFlightOrderErrorResponse>;
        
        if (axiosError.response?.status === 400) {
          const amadeusError = axiosError.response.data;
          if (amadeusError && amadeusError.errors && amadeusError.errors.length > 0) {
            throw new HttpException(
              {
                message: 'Error en cancelación de reserva',
                errors: amadeusError.errors,
                details: amadeusError.errors.map(e => e.detail).join(', ')
              },
              HttpStatus.BAD_REQUEST
            );
          } else {
            throw new HttpException(
              'Error en cancelación de reserva: Parámetros inválidos',
              HttpStatus.BAD_REQUEST
            );
          }
        }
        
        if (axiosError.response?.status === 404) {
          const amadeusError = axiosError.response.data;
          this.logger.error('Amadeus 404 error (cancelación):', amadeusError);
          
          if (amadeusError && amadeusError.errors && amadeusError.errors.length > 0) {
            throw new HttpException(
              {
                message: 'Reserva de vuelo no encontrada',
                errors: amadeusError.errors,
                details: amadeusError.errors.map(e => e.detail).join(', ')
              },
              HttpStatus.NOT_FOUND
            );
          } else {
            throw new HttpException(
              'Reserva de vuelo no encontrada',
              HttpStatus.NOT_FOUND
            );
          }
        }
        
        if (axiosError.response?.status === 409) {
          throw new HttpException(
            'No se puede cancelar la reserva en su estado actual',
            HttpStatus.CONFLICT
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
        'Error interno del servidor al cancelar la reserva',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
