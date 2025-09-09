import { Injectable, Logger } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';
import { 
  SearchLocationsDto, 
  FlightSearchDto,
  FlightOrderDto
} from './dto';
import { 
  AmadeusLocationResponse,
  AmadeusFlightOffersResponse,
  AmadeusFlightOrderRequest,
  AmadeusFlightOrderResponse
} from './interfaces';

@Injectable()
export class VuelosService {
  private readonly logger = new Logger(VuelosService.name);

  constructor(private readonly amadeusService: AmadeusService) {}

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
  async searchCities(searchDto: any): Promise<any> {
    return this.amadeusService.searchCities(searchDto);
  }

  /**
   * Buscar ofertas de vuelos disponibles
   * @param searchDto - Criterios de búsqueda de vuelos
   * @returns Lista de ofertas de vuelos disponibles
   */
  async searchFlightOffers(searchDto: any): Promise<AmadeusFlightOffersResponse> {
    try {
      this.logger.log('Iniciando búsqueda de vuelos...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(searchDto)}`);
      
      // Pasar el request directamente al AmadeusService
      // El AmadeusService se encarga de la transformación
      const result = await this.amadeusService.searchFlightOffers(searchDto);
      this.logger.log('Búsqueda completada exitosamente en VuelosService');
      return result;
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
}
