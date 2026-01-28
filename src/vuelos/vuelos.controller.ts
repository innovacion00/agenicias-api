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
  HttpException,
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
  MaarLabFlightSearchDto,
  CreatePackageDto,
  AddExtrasDto,
  BookPackageDto,
  SearchEngineCompleteProcessDto,
  TravelAgencyCompleteProcessDto
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

  /**
   * Crear un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param createPackageDto - Datos para crear el paquete
   * @param info - Nivel de detalle de la respuesta (query param)
   * @returns Información del paquete creado
   */
  @Post('maarlab/paquete')
  @HttpCode(HttpStatus.CREATED)
  async createPackageMaarLab(
    @Body(new ValidationPipe({ transform: true })) createPackageDto: CreatePackageDto,
    @Query('info') info: string = 'all'
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'createPackageMaarLab',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Creación de paquete MaarLab solicitada`, {
      requestId: logContext.requestId,
      flightId: createPackageDto.flightId,
      currency: createPackageDto.currency,
      language: createPackageDto.language,
      info
    });

    try {
      const packageResult = await this.vuelosService.createPackageMaarLab(createPackageDto, info);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Paquete MaarLab creado exitosamente`, {
        requestId: logContext.requestId,
        hasResult: !!packageResult
      });

      return packageResult;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en creación de paquete MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageParams: {
          flightId: createPackageDto.flightId,
          currency: createPackageDto.currency
        }
      });
      
      throw error;
    }
  }

  /**
   * Obtener información de equipaje disponible para un paquete usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete obtenido después de su creación (query param)
   * @returns Información de equipaje disponible
   */
  @Get('maarlab/equipaje')
  @HttpCode(HttpStatus.OK)
  async getLuggageMaarLab(
    @Query('packageId') packageId: string
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'getLuggageMaarLab',
      method: 'GET',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Consulta de equipaje MaarLab solicitada`, {
      requestId: logContext.requestId,
      packageId
    });

    if (!packageId || packageId.trim() === '') {
      throw new HttpException(
        'El parámetro packageId es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const luggageResult = await this.vuelosService.getLuggageMaarLab(packageId.trim());
      
      this.logger.log(`[CONTROLLER_SUCCESS] Consulta de equipaje MaarLab completada exitosamente`, {
        requestId: logContext.requestId,
        hasResult: !!luggageResult
      });

      return luggageResult;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en consulta de equipaje MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageId
      });
      
      throw error;
    }
  }

  /**
   * Agregar extras seleccionados a un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param addExtrasDto - Datos de los extras a agregar
   * @param packageId - ID del paquete obtenido después de su creación (query param)
   * @param info - Nivel de detalle de la respuesta (query param, default: 'all')
   * @returns Información del paquete actualizado
   */
  @Post('maarlab/extras')
  @HttpCode(HttpStatus.OK)
  async addExtrasMaarLab(
    @Body(new ValidationPipe({ transform: true })) addExtrasDto: AddExtrasDto,
    @Query('packageId') packageIdQuery?: string,
    @Query('info') info: string = 'all'
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'addExtrasMaarLab',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    // Priorizar packageId del query parameter, si no está usar el del body
    const packageId = (packageIdQuery?.trim() || addExtrasDto.packageId?.trim() || '');

    this.logger.log(`[CONTROLLER] Agregado de extras MaarLab solicitado`, {
      requestId: logContext.requestId,
      packageId,
      info
    });

    if (!packageId) {
      throw new HttpException(
        'El parámetro packageId es requerido (puede enviarse como query parameter o en el body)',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.vuelosService.addExtrasMaarLab(
        packageId,
        addExtrasDto.extras,
        info
      );
      
      this.logger.log(`[CONTROLLER_SUCCESS] Extras agregados exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en agregado de extras MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageId
      });
      
      throw error;
    }
  }

  /**
   * Eliminar un extra específico de un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete del cual se elimina el extra (query param)
   * @param itemId - ID del item a eliminar (query param)
   * @param typeExtraId - ID del tipo de extra a eliminar (query param)
   * @param info - Nivel de detalle de la respuesta (query param, default: 'all')
   * @returns Información del paquete actualizado
   */
  @Delete('maarlab/extras')
  @HttpCode(HttpStatus.OK)
  async deleteExtrasMaarLab(
    @Query('packageId') packageId: string,
    @Query('itemId') itemId: string,
    @Query('typeExtraId') typeExtraId: string,
    @Query('info') info: string = 'all'
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'deleteExtrasMaarLab',
      method: 'DELETE',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Eliminación de extra MaarLab solicitada`, {
      requestId: logContext.requestId,
      packageId,
      itemId,
      typeExtraId,
      info
    });

    // Validar parámetros requeridos
    if (!packageId || packageId.trim() === '') {
      throw new HttpException(
        'El parámetro packageId es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!itemId || itemId.trim() === '') {
      throw new HttpException(
        'El parámetro itemId es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!typeExtraId || typeExtraId.trim() === '') {
      throw new HttpException(
        'El parámetro typeExtraId es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Convertir itemId y typeExtraId a números
    const itemIdNum = parseInt(itemId, 10);
    const typeExtraIdNum = parseInt(typeExtraId, 10);

    if (isNaN(itemIdNum)) {
      throw new HttpException(
        'El parámetro itemId debe ser un número entero',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (isNaN(typeExtraIdNum)) {
      throw new HttpException(
        'El parámetro typeExtraId debe ser un número entero',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.vuelosService.deleteExtrasMaarLab(
        packageId.trim(),
        itemIdNum,
        typeExtraIdNum,
        info
      );
      
      this.logger.log(`[CONTROLLER_SUCCESS] Extra eliminado exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en eliminación de extra MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageId,
        itemId,
        typeExtraId
      });
      
      throw error;
    }
  }

  /**
   * Reservar un paquete de vuelo agregando información de pasajeros usando la API de MaarLab Oceanflights
   * @param bookPackageDto - Datos para reservar el paquete (pasajeros, pago, etc.)
   * @param info - Nivel de detalle de la respuesta (query param, default: 'all')
   * @returns Información de la reserva/prebooking
   */
  @Post('maarlab/reservar')
  @HttpCode(HttpStatus.OK)
  async bookPackageMaarLab(
    @Body(new ValidationPipe({ transform: true })) bookPackageDto: BookPackageDto,
    @Query('info') info: string = 'all'
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'bookPackageMaarLab',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Reserva de paquete MaarLab solicitada`, {
      requestId: logContext.requestId,
      packageId: bookPackageDto.packageId,
      passengersCount: bookPackageDto.passengers?.length || 0,
      hasPayment: !!bookPackageDto.payment,
      info
    });

    try {
      const result = await this.vuelosService.bookPackageMaarLab(bookPackageDto, info);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Paquete reservado exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en reserva de paquete MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageId: bookPackageDto.packageId
      });
      
      throw error;
    }
  }

  /**
   * Obtener el token de pago para un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete para obtener el token de pago (query param)
   * @param paymentType - Tipo de pago (query param, opcional)
   * @param deferredPaymentDate - Fecha de pago diferido (query param, opcional, formato YYYY-MM-DD)
   * @returns Token de pago
   */
  @Get('maarlab/token-pago')
  @HttpCode(HttpStatus.OK)
  async getTokenPaymentMaarLab(
    @Query('packageId') packageId: string,
    @Query('paymentType') paymentType?: string,
    @Query('deferredPaymentDate') deferredPaymentDate?: string
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'getTokenPaymentMaarLab',
      method: 'GET',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Obtención de token de pago MaarLab solicitada`, {
      requestId: logContext.requestId,
      packageId,
      paymentType,
      deferredPaymentDate
    });

    if (!packageId || packageId.trim() === '') {
      throw new HttpException(
        'El parámetro packageId es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    // Validar paymentType si se proporciona
    if (paymentType) {
      const validPaymentTypes = ['FLIGHT_ONLY', 'ALL_NOW', 'FLIGHT_NOW_HOTEL_LATER'];
      if (!validPaymentTypes.includes(paymentType)) {
        throw new HttpException(
          `paymentType debe ser uno de: ${validPaymentTypes.join(', ')}`,
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    // Validar formato de deferredPaymentDate si se proporciona
    if (deferredPaymentDate) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(deferredPaymentDate)) {
        throw new HttpException(
          'deferredPaymentDate debe venir en formato YYYY-MM-DD',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Si se proporciona deferredPaymentDate, paymentType debe ser FLIGHT_NOW_HOTEL_LATER
      if (paymentType && paymentType !== 'FLIGHT_NOW_HOTEL_LATER') {
        throw new HttpException(
          'deferredPaymentDate solo puede usarse cuando paymentType es FLIGHT_NOW_HOTEL_LATER',
          HttpStatus.BAD_REQUEST,
        );
      }
    }

    try {
      const result = await this.vuelosService.getTokenPaymentMaarLab(
        packageId.trim(),
        paymentType,
        deferredPaymentDate
      );
      
      this.logger.log(`[CONTROLLER_SUCCESS] Token de pago obtenido exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en obtención de token de pago MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageId
      });
      
      throw error;
    }
  }

  /**
   * Obtener los detalles completos de un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete a obtener (query param)
   * @param info - Nivel de detalle de la respuesta (query param, default: 'all')
   * @returns Detalles completos del paquete
   */
  @Get('maarlab/paquete')
  @HttpCode(HttpStatus.OK)
  async getPackageMaarLab(
    @Query('packageId') packageId: string,
    @Query('info') info: string = 'all'
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'getPackageMaarLab',
      method: 'GET',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Obtención de detalles de paquete MaarLab solicitada`, {
      requestId: logContext.requestId,
      packageId,
      info
    });

    if (!packageId || packageId.trim() === '') {
      throw new HttpException(
        'El parámetro packageId es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.vuelosService.getPackageMaarLab(packageId.trim(), info);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Detalles de paquete obtenidos exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en obtención de detalles de paquete MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageId
      });
      
      throw error;
    }
  }

  /**
   * Obtener el contrato de factura ATOL para un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete para obtener el contrato ATOL (query param)
   * @returns Contrato de factura ATOL
   */
  @Get('maarlab/contrato-atol')
  @HttpCode(HttpStatus.OK)
  async getInvoiceATOLContractMaarLab(
    @Query('packageId') packageId: string
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'getInvoiceATOLContractMaarLab',
      method: 'GET',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Obtención de contrato ATOL MaarLab solicitada`, {
      requestId: logContext.requestId,
      packageId
    });

    if (!packageId || packageId.trim() === '') {
      throw new HttpException(
        'El parámetro packageId es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.vuelosService.getInvoiceATOLContractMaarLab(packageId.trim());
      
      this.logger.log(`[CONTROLLER_SUCCESS] Contrato ATOL obtenido exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en obtención de contrato ATOL MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        packageId
      });
      
      throw error;
    }
  }

  /**
   * Crear hoteles con configuración por defecto usando la API de MaarLab Oceanflights
   * @param completeProcessDto - Datos del hotel a crear
   * @returns Información del hotel creado o actualizado
   */
  @Post('maarlab/search-engine/complete-process')
  @HttpCode(HttpStatus.CREATED)
  async searchEngineCompleteProcessMaarLab(
    @Body(new ValidationPipe({ transform: true })) completeProcessDto: SearchEngineCompleteProcessDto
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'searchEngineCompleteProcessMaarLab',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Creación de hotel MaarLab solicitada`, {
      requestId: logContext.requestId,
      hotelName: completeProcessDto.name,
      externalId: completeProcessDto.external_id,
      hasPrefixLocator: !!completeProcessDto.prefix_locator
    });

    try {
      const result = await this.vuelosService.searchEngineCompleteProcessMaarLab(completeProcessDto);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Hotel creado/actualizado exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en creación de hotel MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        hotelName: completeProcessDto.name,
        externalId: completeProcessDto.external_id
      });
      
      throw error;
    }
  }

  /**
   * Crear agencias de viajes con configuración por defecto usando la API de MaarLab Oceanflights
   * @param completeProcessDto - Datos de la agencia de viajes a crear
   * @returns Información de la agencia de viajes creada o actualizada
   */
  @Post('maarlab/travel-agency/complete-process')
  @HttpCode(HttpStatus.CREATED)
  async travelAgencyCompleteProcessMaarLab(
    @Body(new ValidationPipe({ transform: true })) completeProcessDto: TravelAgencyCompleteProcessDto
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'travelAgencyCompleteProcessMaarLab',
      method: 'POST',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Creación de agencia de viajes MaarLab solicitada`, {
      requestId: logContext.requestId,
      agencyName: completeProcessDto.name,
      externalId: completeProcessDto.external_id,
      hasPrefixLocator: !!completeProcessDto.prefix_locator
    });

    try {
      const result = await this.vuelosService.travelAgencyCompleteProcessMaarLab(completeProcessDto);
      
      this.logger.log(`[CONTROLLER_SUCCESS] Agencia de viajes creada/actualizada exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en creación de agencia de viajes MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        agencyName: completeProcessDto.name,
        externalId: completeProcessDto.external_id
      });
      
      throw error;
    }
  }

  /**
   * Obtener el external ID de un hotel desde el ID interno de Oceanflight usando la API de MaarLab Oceanflights
   * @param idSearchEngine - ID interno del search engine (Oceanflight) (path param)
   * @returns External ID del hotel
   */
  @Get('maarlab/search-engine/mapping-external-id/:idSearchEngine')
  @HttpCode(HttpStatus.OK)
  async mappingExternalIdSearchEngineMaarLab(
    @Param('idSearchEngine') idSearchEngine: string
  ): Promise<any> {
    const logContext: LogContext = {
      requestId: this.generateRequestId(),
      endpoint: 'mappingExternalIdSearchEngineMaarLab',
      method: 'GET',
      timestamp: new Date().toISOString()
    };

    this.logger.log(`[CONTROLLER] Obtención de external ID MaarLab solicitada`, {
      requestId: logContext.requestId,
      idSearchEngine
    });

    if (!idSearchEngine || idSearchEngine.trim() === '') {
      throw new HttpException(
        'El parámetro idSearchEngine es requerido',
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const result = await this.vuelosService.mappingExternalIdSearchEngineMaarLab(idSearchEngine.trim());
      
      this.logger.log(`[CONTROLLER_SUCCESS] External ID obtenido exitosamente en MaarLab`, {
        requestId: logContext.requestId,
        hasResult: !!result
      });

      return result;
    } catch (error) {
      this.logger.error(`[CONTROLLER_ERROR] Error en obtención de external ID MaarLab`, {
        requestId: logContext.requestId,
        error: error.message,
        idSearchEngine
      });
      
      throw error;
    }
  }
}
