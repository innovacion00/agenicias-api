import { Injectable, Logger } from '@nestjs/common';
import { AmadeusService } from './amadeus.service';
import { 
  SearchLocationsDto, 
  FlightSearchDto 
} from './dto';
import { 
  AmadeusLocationResponse,
  AmadeusFlightOffersResponse 
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
}
