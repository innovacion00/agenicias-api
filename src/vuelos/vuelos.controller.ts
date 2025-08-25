import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ValidationPipe,
  HttpStatus,
  HttpCode,
  Logger,
} from '@nestjs/common';
import { VuelosService } from './vuelos.service';
import {
  SearchLocationsDto,
  FlightSearchDto
} from './dto';
import {
  AmadeusLocationResponse,
  AmadeusFlightOffersResponse
} from './interfaces';

@Controller('vuelos')
export class VuelosController {
  private readonly logger = new Logger(VuelosController.name);

  constructor(private readonly vuelosService: VuelosService) {}

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

  /**
   * Endpoint de prueba para depurar problemas de disponibilidad
   */
  @Post('disponibilidad-test')
  @HttpCode(HttpStatus.OK)
  async searchFlightOffersTest(@Body() rawBody: any): Promise<any> {
    this.logger.log('🔍 Endpoint de prueba llamado');
    this.logger.log(`Raw body: ${JSON.stringify(rawBody)}`);
    
    try {
      // Crear un request con la estructura exacta que espera Amadeus
      const basicRequest = {
        currencyCode: rawBody.currencyCode || 'USD',
        originDestinations: rawBody.originDestinations.map(od => ({
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
  ): Promise<AmadeusFlightOffersResponse> {
    this.logger.log(`Búsqueda de vuelos solicitada: ${JSON.stringify({
      origin: searchDto.originDestinations[0]?.originLocationCode,
      destination: searchDto.originDestinations[0]?.destinationLocationCode,
      date: searchDto.originDestinations[0]?.departureDate,
      travelers: searchDto.travelers.length
    })}`);

    try {
      const offers = await this.vuelosService.searchFlightOffers(searchDto);
      
      this.logger.log(`Búsqueda exitosa: ${offers.meta.count} ofertas encontradas`);
      return offers;
    } catch (error) {
      this.logger.error('Error en búsqueda de vuelos:', error);
      throw error;
    }
  }
}
