import { Injectable, Logger } from '@nestjs/common';
import { AmadeusService } from '../amadeus.service';
import { 
  AmadeusFlightOffersResponse, 
  AmadeusFlightOffer, 
  AmadeusItinerary, 
  AmadeusSegment 
} from '../interfaces/amadeus-flight-offers.interface';
import { 
  EnrichedFlightOffersResponse, 
  EnrichedFlightOffer, 
  EnrichedFlightItinerary, 
  EnrichedFlightSegment, 
  EnrichedFlightLocation 
} from '../interfaces/enriched-flight-offers.interface';

@Injectable()
export class FlightEnrichmentService {
  private readonly logger = new Logger(FlightEnrichmentService.name);
  private cityCache = new Map<string, string>();

  constructor(private readonly amadeusService: AmadeusService) {}

  /**
   * Enriquece las ofertas de vuelos con nombres de ciudades
   * @param flightOffersResponse - Respuesta original de Amadeus
   * @returns Respuesta enriquecida con nombres de ciudades
   */
  async enrichFlightOffers(
    flightOffersResponse: AmadeusFlightOffersResponse
  ): Promise<EnrichedFlightOffersResponse> {
    try {
      // Recopilar todos los códigos IATA únicos de la respuesta
      const iataCodes = this.extractUniqueIataCodes(flightOffersResponse);
      
      // Obtener nombres de ciudades para todos los códigos IATA
      const cityNamesMap = await this.getCityNamesForIataCodes(iataCodes);

      // Enriquecer la respuesta con los nombres de ciudades
      const enrichedOffers = this.enrichOffersWithCityNames(
        flightOffersResponse.data, 
        cityNamesMap
      );

      return {
        ...flightOffersResponse,
        data: enrichedOffers
      };
    } catch (error) {
      this.logger.warn('Error al enriquecer con nombres de ciudades, devolviendo respuesta original:', error);
      // En caso de error, devolver la respuesta original sin enriquecimiento
      return this.convertToEnrichedResponse(flightOffersResponse);
    }
  }

  /**
   * Extrae todos los códigos IATA únicos de la respuesta de vuelos
   */
  private extractUniqueIataCodes(flightOffersResponse: AmadeusFlightOffersResponse): string[] {
    const iataCodes = new Set<string>();
    
    for (const offer of flightOffersResponse.data) {
      for (const itinerary of offer.itineraries) {
        for (const segment of itinerary.segments) {
          iataCodes.add(segment.departure.iataCode);
          iataCodes.add(segment.arrival.iataCode);
        }
      }
    }

    return Array.from(iataCodes);
  }

  /**
   * Obtiene nombres de ciudades para múltiples códigos IATA
   */
  private async getCityNamesForIataCodes(iataCodes: string[]): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const uncachedCodes: string[] = [];

    // Verificar cache para cada código
    for (const code of iataCodes) {
      const cachedCity = this.cityCache.get(code);
      if (cachedCity) {
        result.set(code, cachedCity);
      } else {
        uncachedCodes.push(code);
      }
    }

    // Buscar códigos no cacheados uno por uno
    if (uncachedCodes.length > 0) {
      const searchPromises = uncachedCodes.map(async (code) => {
        try {
          const response = await this.amadeusService.searchAirportsByIata(code);
          
          if (response.data && response.data.length > 0) {
            const location = response.data[0];
            if (location) {
              const cityName = location.address?.cityName || 
                             location.detailedName || 
                             location.name || 
                             code;
            
              result.set(code, cityName);
              this.cityCache.set(code, cityName);
            } else {
              result.set(code, code);
              this.cityCache.set(code, code);
            }
          } else {
            result.set(code, code);
            this.cityCache.set(code, code);
          }
        } catch (error) {
          this.logger.warn(`Error al buscar ciudad para código IATA ${code}:`, error);
          result.set(code, code);
          this.cityCache.set(code, code);
        }
      });

      // Esperar a que todas las búsquedas terminen
      await Promise.all(searchPromises);
    }

    return result;
  }

  /**
   * Enriquece las ofertas con nombres de ciudades
   */
  private enrichOffersWithCityNames(
    offers: AmadeusFlightOffer[], 
    cityNamesMap: Map<string, string>
  ): EnrichedFlightOffer[] {
    return offers.map(offer => ({
      ...offer,
      itineraries: offer.itineraries.map(itinerary => 
        this.enrichItinerary(itinerary, cityNamesMap)
      )
    }));
  }

  /**
   * Enriquece un itinerario con nombres de ciudades
   */
  private enrichItinerary(
    itinerary: AmadeusItinerary, 
    cityNamesMap: Map<string, string>
  ): EnrichedFlightItinerary {
    return {
      ...itinerary,
      segments: itinerary.segments.map(segment => 
        this.enrichSegment(segment, cityNamesMap)
      )
    };
  }

  /**
   * Enriquece un segmento con nombres de ciudades
   */
  private enrichSegment(
    segment: AmadeusSegment, 
    cityNamesMap: Map<string, string>
  ): EnrichedFlightSegment {
    return {
      ...segment,
      departure: this.enrichLocation(segment.departure, cityNamesMap),
      arrival: this.enrichLocation(segment.arrival, cityNamesMap)
    };
  }

  /**
   * Enriquece una ubicación con nombre de ciudad
   */
  private enrichLocation(
    location: { iataCode: string; terminal?: string; at: string }, 
    cityNamesMap: Map<string, string>
  ): EnrichedFlightLocation {
    return {
      ...location,
      cityName: cityNamesMap.get(location.iataCode) || location.iataCode
    };
  }

  /**
   * Convierte la respuesta original a formato enriquecido sin enriquecimiento
   */
  private convertToEnrichedResponse(
    flightOffersResponse: AmadeusFlightOffersResponse
  ): EnrichedFlightOffersResponse {
    return {
      ...flightOffersResponse,
      data: flightOffersResponse.data.map(offer => ({
        ...offer,
        itineraries: offer.itineraries.map(itinerary => ({
          ...itinerary,
          segments: itinerary.segments.map(segment => ({
            ...segment,
            departure: {
              ...segment.departure,
              cityName: segment.departure.iataCode
            },
            arrival: {
              ...segment.arrival,
              cityName: segment.arrival.iataCode
            }
          }))
        }))
      }))
    };
  }

  /**
   * Limpia el cache de ciudades
   */
  clearCache(): void {
    this.cityCache.clear();
  }
}
