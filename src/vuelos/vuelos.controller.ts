import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ValidationPipe,
  HttpStatus,
  HttpCode,
  Logger,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { VuelosService } from './vuelos.service';
import { ErrorHandlerService } from './services/error-handler.service';
import { ErrorHandlerInterceptor } from './interceptors/error-handler.interceptor';
import { ErrorHandlerFilter } from './filters/error-handler.filter';
import { LogContext } from './interfaces/error-response.interface';
import {
  SearchLocationsDto,
  FlightSearchDto,
  SearchCitiesDto,
  FlightOrderDto,
  MaarLabFlightSearchDto
} from './dto';
import {
  AmadeusLocationResponse,
  AmadeusFlightOrderResponse
} from './interfaces';

@Controller('vuelos')
@UseInterceptors(ErrorHandlerInterceptor)
@UseFilters(ErrorHandlerFilter)
export class VuelosController {
  private readonly logger = new Logger(VuelosController.name);

  constructor(
    private readonly vuelosService: VuelosService,
  ) {}

  /**
   * Genera un ID único para la solicitud
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  @Get('test')
  @HttpCode(HttpStatus.OK)
  async test(): Promise<{ message: string; status: string }> {
    this.logger.log('Endpoint de prueba llamado');
    return {
      message: 'El módulo de vuelos está funcionando correctamente',
      status: 'OK'
    };
  }

  @Get('test-auth')
  @HttpCode(HttpStatus.OK)
  async testAuthentication(): Promise<{ message: string; status: string; tokenInfo?: any }> {
    this.logger.log('Probando autenticación con Amadeus...');
    
    try {
      // Intentar obtener un token para verificar que las credenciales funcionan
      const token = await this.vuelosService.testAuthentication();
      
      return {
        message: 'Autenticación con Amadeus exitosa',
        status: 'OK',
        tokenInfo: {
          tokenLength: token.length,
          tokenPreview: token.substring(0, 10) + '...',
          timestamp: new Date().toISOString(),
        }
      };
    } catch (error) {
      this.logger.error('Error en autenticación con Amadeus:', error);
      throw error;
    }
  }

  @Get('ubicaciones')
  @HttpCode(HttpStatus.OK)
  async searchLocations(
    @Query(new ValidationPipe({ transform: true })) searchDto: SearchLocationsDto,
  ): Promise<AmadeusLocationResponse> {
    this.logger.log(`Búsqueda de ubicaciones solicitada: ${JSON.stringify(searchDto)}`);
    
    try {
      const result = await this.vuelosService.searchLocations(searchDto);
      this.logger.log(`Búsqueda exitosa: ${result.meta.count} resultados encontrados`);
      return result;
    } catch (error) {
      this.logger.error('Error en búsqueda de ubicaciones:', error);
      throw error;
    }
  }

  @Get('aeropuertos/iata/:iataCode')
  @HttpCode(HttpStatus.OK)
  async searchAirportByIata(@Param('iataCode') iataCode: string): Promise<AmadeusLocationResponse> {
    this.logger.log(`Búsqueda de aeropuerto por IATA: ${iataCode}`);
    
    try {
      const result = await this.vuelosService.searchAirportsByIata(iataCode);
      this.logger.log(`Aeropuerto encontrado: ${result.meta.count} resultados`);
      return result;
    } catch (error) {
      this.logger.error(`Error al buscar aeropuerto por IATA ${iataCode}:`, error);
      throw error;
    }
  }

  @Get('ciudades')
  @HttpCode(HttpStatus.OK)
  async searchCitiesByName(
    @Query('nombre') cityName: string,
    @Query('countryCode') countryCode?: string,
  ): Promise<AmadeusLocationResponse> {
    this.logger.log(`Búsqueda de ciudades: ${cityName}${countryCode ? ` en ${countryCode}` : ''}`);
    
    try {
      const result = await this.vuelosService.searchCitiesByName(cityName, countryCode);
      this.logger.log(`Ciudades encontradas: ${result.meta.count} resultados`);
      return result;
    } catch (error) {
      this.logger.error(`Error al buscar ciudades por nombre ${cityName}:`, error);
      throw error;
    }
  }

  @Get('ciudades/buscar')
  @HttpCode(HttpStatus.OK)
  async searchCities(
    @Query(new ValidationPipe({ transform: true })) searchDto: SearchCitiesDto,
  ): Promise<any> {
    this.logger.log(`Búsqueda de ciudades con parámetros: ${JSON.stringify(searchDto)}`);
    
    try {
      const result = await this.vuelosService.searchCities(searchDto);
      this.logger.log(`Búsqueda exitosa: ${result.meta?.count || 'N/A'} resultados encontrados`);
      return result;
    } catch (error) {
      this.logger.error('Error en búsqueda de ciudades:', error);
      throw error;
    }
  }


  /**
   * Endpoint de prueba para depurar problemas de disponibilidad
   */
  @Post('disponibilidad-test')
  @HttpCode(HttpStatus.OK)
  async searchFlightOffersTest(@Body() rawBody: any): Promise<any> {
    this.logger.log(' Endpoint de prueba llamado');
    this.logger.log(`Raw body: ${JSON.stringify(rawBody)}`);
    
    try {
      // Crear un request con la estructura exacta que espera Amadeus
      const basicRequest = {
        currencyCode: rawBody.currencyCode || 'USD',
        originDestinations: rawBody.originDestinations.map((od: {
          id: string;
          originLocationCode: string;
          destinationLocationCode: string;
          departureDateTimeRange: { date: string; time?: string };
        }) => ({
          id: od.id,
          originLocationCode: od.originLocationCode,
          destinationLocationCode: od.destinationLocationCode,
          departureDateTimeRange: {
            date: od.departureDateTimeRange.date,
            time: od.departureDateTimeRange.time || '08:00:00'
          }
        })),
        travelers: rawBody.travelers,
        sources: rawBody.sources || ['GDS'],
        searchCriteria: rawBody.searchCriteria || {
          maxFlightOffers: 5
        }
      };
      
      this.logger.log(`Request para Amadeus: ${JSON.stringify(basicRequest)}`);
      
      const result = await this.vuelosService.searchFlightOffers(basicRequest as any);
      return result;
    } catch (error) {
      this.logger.error('Error en endpoint de prueba:', error);
      throw error;
    }
  }

  /**
   * Buscar ofertas de vuelos disponibles
   * @param searchDto - Criterios de búsqueda de vuelos
   * @returns Lista de ofertas de vuelos disponibles
   */
  @Post('disponibilidad')
  @HttpCode(HttpStatus.OK)
  async searchFlightOffers(
    @Body(new ValidationPipe({ transform: true })) searchDto: FlightSearchDto
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'searchFlightOffers',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Búsqueda de vuelos solicitada`, {
      requestId: logContext.requestId,
      origin: searchDto.originDestinations[0]?.originLocationCode,
      destination: searchDto.originDestinations[0]?.destinationLocationCode,
      date: searchDto.originDestinations[0]?.departureDate,
      travelers: searchDto.travelers.length,
      currencyCode: searchDto.currencyCode
    });

    try {
      const offers = await this.vuelosService.searchFlightOffers(searchDto);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Búsqueda de vuelos completada`, {
        requestId: logContext.requestId,
        offersFound: offers.meta.count,
        currency: (offers.meta as any)?.currency || 'N/A',
        searchDuration: (offers.meta as any)?.searchDuration || 'N/A'
      });

      return offers;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en búsqueda de vuelos`, {
        requestId: logContext.requestId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        searchParams: {
          origin: searchDto.originDestinations[0]?.originLocationCode,
          destination: searchDto.originDestinations[0]?.destinationLocationCode,
          date: searchDto.originDestinations[0]?.departureDate,
          travelers: searchDto.travelers.length
        }
      });
      
      throw error;
    }
  }

  /**
   * Crear una reserva de vuelo
   * @param orderDto - Datos de la reserva de vuelo
   * @returns Confirmación de la reserva
   */
  @Post('reservar')
  @HttpCode(HttpStatus.CREATED)
  async createFlightOrder(
    @Body(new ValidationPipe({ transform: true })) orderDto: FlightOrderDto
  ): Promise<AmadeusFlightOrderResponse> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'createFlightOrder',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Reserva de vuelo solicitada`, {
      requestId: logContext.requestId,
      flightOffers: orderDto.flightOffers.length,
      travelers: orderDto.travelers.length,
      hasRemarks: !!orderDto.remarks,
      hasContacts: !!orderDto.contacts
    });

    try {
      const order = await this.vuelosService.createFlightOrder(orderDto);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Reserva de vuelo creada exitosamente`, {
        requestId: logContext.requestId,
        orderId: order.data.id,
        travelers: order.data.travelers?.length || 0,
        flightOffers: order.data.flightOffers?.length || 0,
        status: order.data.type
      });

      return order;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en reserva de vuelo`, {
        requestId: logContext.requestId,
        error: error instanceof Error ? error.message : 'Error desconocido',
        orderParams: {
          flightOffers: orderDto.flightOffers.length,
          travelers: orderDto.travelers.length,
          hasRemarks: !!orderDto.remarks,
          hasContacts: !!orderDto.contacts
        }
      });
      
      throw error;
    }
  }

  /**
   * Consulta una reserva de vuelo específica
   * @param flightOrderId - ID de la reserva de vuelo
   * @returns Información de la reserva
   */
  @Get('reservas/:flightOrderId')
  @HttpCode(HttpStatus.OK)
  async getFlightOrder(
    @Param('flightOrderId') flightOrderId: string
  ): Promise<AmadeusFlightOrderResponse> {
    this.logger.log(`Consulta de reserva solicitada: ${flightOrderId}`);

    try {
      const order = await this.vuelosService.getFlightOrder(flightOrderId);
      
      this.logger.log(`Reserva consultada exitosamente: ${order.data.id}`);
      return order;
    } catch (error) {
      this.logger.error(`Error consultando reserva ${flightOrderId}:`, error);
      throw error;
    }
  }

  /**
   * Cancela una reserva de vuelo específica
   * @param flightOrderId - ID de la reserva de vuelo a cancelar
   * @returns Confirmación de la cancelación
   */
  @Delete('reservas/:flightOrderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancelFlightOrder(
    @Param('flightOrderId') flightOrderId: string
  ): Promise<void> {
    this.logger.log(`Cancelación de reserva solicitada: ${flightOrderId}`);

    try {
      await this.vuelosService.cancelFlightOrder(flightOrderId);
      
      this.logger.log(`Reserva cancelada exitosamente: ${flightOrderId}`);
    } catch (error) {
      this.logger.error(`Error cancelando reserva ${flightOrderId}:`, error);
      throw error;
    }
  }

  /**
   * Buscar vuelos usando la API de MaarLab Oceanflights
   * @param searchDto - Criterios de búsqueda de vuelos
   * @returns Lista de ofertas de vuelos disponibles
   */
  @Post('maarlab/disponibilidad')
  @HttpCode(HttpStatus.OK)
  async searchFlightsMaarLab(
    @Body(new ValidationPipe({ transform: true })) searchDto: MaarLabFlightSearchDto
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'searchFlightsMaarLab',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Búsqueda de vuelos MaarLab solicitada`, {
      requestId: logContext.requestId,
      origin: searchDto.origin,
      destination: searchDto.destination,
      departureDate: searchDto.departureDate,
      returnDate: searchDto.returnDate,
      adults: searchDto.adults,
      ages: searchDto.ages,
      currency: searchDto.currency
    });

    try {
      const offers = await this.vuelosService.searchFlightsMaarLab(searchDto);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Búsqueda de vuelos MaarLab completada`, {
        requestId: logContext.requestId,
        hasResults: !!offers
      });

      return offers;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en búsqueda de vuelos MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        searchParams: {
          origin: searchDto.origin,
          destination: searchDto.destination,
          departureDate: searchDto.departureDate,
          adults: searchDto.adults
        }
      });
      
      throw error;
    }
  }
}
