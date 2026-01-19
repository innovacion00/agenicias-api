import { Injectable, Logger } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';
import { MaarLabService } from './maarlab.service';
import { FlightEnrichmentService } from './services/flight-enrichment.service';
import { 
  SearchLocationsDto, 
  FlightOrderDto
} from './dto';
import { MaarLabFlightSearchDto } from './dto/maarlab-flight-search.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { 
  AmadeusLocationResponse,
  AmadeusFlightOrderRequest,
  AmadeusFlightOrderResponse
} from './interfaces';
import { EnrichedFlightOffersResponse } from './interfaces/enriched-flight-offers.interface';

@Injectable()
export class VuelosService {
  private readonly logger = new Logger(VuelosService.name);

  constructor(
    private readonly amadeusService: AmadeusService,
    private readonly maarlabService: MaarLabService,
    private readonly flightEnrichmentService: FlightEnrichmentService
  ) {}

  /**
   * Probar autenticación con Amadeus
   * @returns Token de acceso
   */
  async testAuthentication(): Promise<string> {
    return this.amadeusService.testAuthentication();
  }

  /**
   * Buscar ubicaciones (aeropuertos y ciudades)
   * @param searchDto - Parámetros de búsqueda
   * @returns Lista de ubicaciones encontradas
   */
  async searchLocations(searchDto: SearchLocationsDto): Promise<AmadeusLocationResponse> {
    return this.amadeusService.searchLocations(searchDto);
  }

  /**
   * Buscar aeropuerto por código IATA
   * @param iataCode - Código IATA del aeropuerto
   * @returns Información del aeropuerto
   */
  async searchAirportsByIata(iataCode: string): Promise<AmadeusLocationResponse> {
    return this.amadeusService.searchAirportsByIata(iataCode);
  }

  /**
   * Buscar ciudades por nombre
   * @param cityName - Nombre de la ciudad
   * @param countryCode - Código del país (opcional)
   * @returns Lista de ciudades encontradas
   */
  async searchCitiesByName(cityName: string, countryCode?: string): Promise<AmadeusLocationResponse> {
    return this.amadeusService.searchCitiesByName(cityName, countryCode);
  }

  /**
   * Buscar ciudades usando la API específica de ciudades de Amadeus
   * @param searchDto - Parámetros de búsqueda de ciudades
   * @returns Lista de ciudades encontradas
   */
  async searchCities(searchDto: {
    countryCode?: string;
    keyword: string;
    max?: number;
    include?: string[];
  }): Promise<AmadeusLocationResponse> {
    return this.amadeusService.searchCities(searchDto);
  }


  /**
   * Buscar ofertas de vuelos disponibles
   * @param searchDto - Criterios de búsqueda de vuelos
   * @returns Lista de ofertas de vuelos disponibles con nombres de ciudades
   */
  async searchFlightOffers(searchDto: any): Promise<EnrichedFlightOffersResponse> {
    try {
      this.logger.log('Iniciando búsqueda de vuelos...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(searchDto)}`);
      
      // Pasar el request directamente al AmadeusService
      // El AmadeusService se encarga de la transformación
      const result = await this.amadeusService.searchFlightOffers(searchDto);
      
      // Enriquecer la respuesta con nombres de ciudades usando el servicio aislado
      const enrichedResult = await this.flightEnrichmentService.enrichFlightOffers(result);
      
      this.logger.log('Búsqueda completada exitosamente en VuelosService');
      return enrichedResult;
    } catch (error) {
      this.logger.error('Error en VuelosService.searchFlightOffers:', error);
      throw error;
    }
  }


  /**
   * Crear una reserva de vuelo
   * @param orderDto - Datos de la reserva de vuelo
   * @returns Confirmación de la reserva
   */
  async createFlightOrder(orderDto: FlightOrderDto): Promise<AmadeusFlightOrderResponse> {
    try {
      this.logger.log('Iniciando proceso de reserva de vuelo...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify({
        flightOffers: orderDto.flightOffers.length,
        travelers: orderDto.travelers.length,
        hasRemarks: !!orderDto.remarks,
        hasContacts: !!orderDto.contacts
      })}`);
      
      // Transformar el DTO al formato requerido por Amadeus
      const amadeusRequest: AmadeusFlightOrderRequest = {
        data: {
          type: 'flight-order',
          flightOffers: orderDto.flightOffers,
          travelers: orderDto.travelers,
          remarks: orderDto.remarks,
          ticketingAgreement: orderDto.ticketingAgreement,
          contacts: orderDto.contacts
        }
      };
      
      // Llamar al servicio de Amadeus
      const result = await this.amadeusService.createFlightOrder(amadeusRequest);
      
      this.logger.log(`Reserva creada exitosamente: ${result.data.id}`);
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.createFlightOrder:', error);
      throw error;
    }
  }

  /**
   * Consulta una reserva de vuelo específica
   * @param flightOrderId - ID de la reserva de vuelo
   * @returns Información de la reserva
   */
  async getFlightOrder(flightOrderId: string): Promise<AmadeusFlightOrderResponse> {
    try {
      this.logger.log(`Consultando reserva de vuelo: ${flightOrderId}`);
      
      const result = await this.amadeusService.getFlightOrder(flightOrderId);
      
      this.logger.log(`Reserva consultada exitosamente: ${result.data.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Error en VuelosService.getFlightOrder:`, error);
      throw error;
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
      
      await this.amadeusService.cancelFlightOrder(flightOrderId);
      
      this.logger.log(`Reserva cancelada exitosamente: ${flightOrderId}`);
    } catch (error) {
      this.logger.error(`Error en VuelosService.cancelFlightOrder:`, error);
      throw error;
    }
  }

  /**
   * Busca vuelos usando la API de MaarLab Oceanflights
   * @param searchDto - Parámetros de búsqueda de vuelos
   * @returns Lista de ofertas de vuelos disponibles
   */
  async searchFlightsMaarLab(searchDto: MaarLabFlightSearchDto): Promise<any> {
    try {
      this.logger.log('Iniciando búsqueda de vuelos en MaarLab...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(searchDto)}`);
      
      const result = await this.maarlabService.searchFlights(searchDto);
      
      this.logger.log('Búsqueda completada exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.searchFlightsMaarLab:', error);
      throw error;
    }
  }

  /**
   * Crea un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param createPackageDto - Datos para crear el paquete
   * @param info - Nivel de detalle de la respuesta
   * @returns Información del paquete creado
   */
  async createPackageMaarLab(createPackageDto: CreatePackageDto, info: string = 'all'): Promise<any> {
    try {
      this.logger.log('Iniciando creación de paquete de vuelo en MaarLab...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(createPackageDto)}`);
      
      const result = await this.maarlabService.createPackage(createPackageDto, info);
      
      this.logger.log('Paquete creado exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.createPackageMaarLab:', error);
      throw error;
    }
  }
}
