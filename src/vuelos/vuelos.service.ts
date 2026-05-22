import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AmadeusService } from './amadeus.service';
import { MaarLabService } from './maarlab.service';
import { FlightEnrichmentService } from './services/flight-enrichment.service';
import { 
  SearchLocationsDto, 
  FlightOrderDto
} from './dto';
import { MaarLabFlightSearchDto } from './dto/maarlab-flight-search.dto';
import { CreatePackageDto } from './dto/create-package.dto';
import { BookPackageDto } from './dto/book-package.dto';
import { 
  AmadeusLocationResponse,
  AmadeusFlightOrderRequest,
  AmadeusFlightOrderResponse
} from './interfaces';
import { EnrichedFlightOffersResponse } from './interfaces/enriched-flight-offers.interface';
import { Reserva } from 'src/reservas/entities';
import { Types } from 'mongoose';
import { AgenciasService } from 'src/agencias/agencias.service';
import { applyMaarLabAvailabilityMarkupAsString } from './utils/flight-availability-markup.util';

@Injectable()
export class VuelosService {
  private readonly logger = new Logger(VuelosService.name);

  constructor(
    private readonly amadeusService: AmadeusService,
    private readonly maarlabService: MaarLabService,
    private readonly flightEnrichmentService: FlightEnrichmentService,
    private readonly agenciasService: AgenciasService,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
  ) {}

  private async bearerMaarLab(agenciaId: Types.ObjectId): Promise<string> {
    return this.agenciasService.getMaarLabApiKeyOrThrow(agenciaId);
  }

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
  async searchFlightsMaarLab(
    agenciaId: Types.ObjectId,
    searchDto: MaarLabFlightSearchDto,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando búsqueda de vuelos en MaarLab...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(searchDto)}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.searchFlights(bearer, searchDto);

      this.logger.log('Búsqueda completada exitosamente en VuelosService');
      return applyMaarLabAvailabilityMarkupAsString(result);
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
  async createPackageMaarLab(
    agenciaId: Types.ObjectId,
    createPackageDto: CreatePackageDto,
    info: string = 'all',
  ): Promise<any> {
    try {
      this.logger.log('Iniciando creación de paquete de vuelo en MaarLab...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(createPackageDto)}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.createPackage(
        bearer,
        createPackageDto,
        info,
      );
      
      this.logger.log('Paquete creado exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.createPackageMaarLab:', error);
      throw error;
    }
  }

  /**
   * Obtiene información de equipaje disponible para un paquete usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete obtenido después de su creación
   * @returns Información de equipaje disponible
   */
  async getLuggageMaarLab(
    agenciaId: Types.ObjectId,
    packageId: string,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando consulta de equipaje en MaarLab...');
      this.logger.log(`Package ID recibido en VuelosService: ${packageId}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.getLuggage(bearer, packageId);
      
      this.logger.log('Consulta de equipaje completada exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.getLuggageMaarLab:', error);
      throw error;
    }
  }

  /**
   * Agrega extras seleccionados a un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete obtenido después de su creación
   * @param extrasData - Datos de los extras a agregar
   * @param info - Nivel de detalle de la respuesta
   * @returns Información del paquete actualizado
   */
  async addExtrasMaarLab(
    agenciaId: Types.ObjectId,
    packageId: string,
    extrasData: any,
    info: string = 'all',
  ): Promise<any> {
    try {
      this.logger.log('Iniciando agregado de extras en MaarLab...');
      this.logger.log(`Package ID recibido en VuelosService: ${packageId}, Info: ${info}`);
      this.logger.log(`Extras data: ${JSON.stringify(extrasData)}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.addExtras(
        bearer,
        packageId,
        extrasData,
        info,
      );
      
      this.logger.log('Extras agregados exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.addExtrasMaarLab:', error);
      throw error;
    }
  }

  /**
   * Elimina un extra específico de un paquete de vuelo usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete del cual se elimina el extra
   * @param itemId - ID del item a eliminar
   * @param typeExtraId - ID del tipo de extra a eliminar
   * @param info - Nivel de detalle de la respuesta
   * @returns Información del paquete actualizado
   */
  async deleteExtrasMaarLab(
    agenciaId: Types.ObjectId,
    packageId: string,
    itemId: number,
    typeExtraId: number,
    info: string = 'all',
  ): Promise<any> {
    try {
      this.logger.log('Iniciando eliminación de extra en MaarLab...');
      this.logger.log(
        `Package ID: ${packageId}, Item ID: ${itemId}, Type Extra ID: ${typeExtraId}, Info: ${info}`
      );
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.deleteExtras(
        bearer,
        packageId,
        itemId,
        typeExtraId,
        info,
      );
      
      this.logger.log('Extra eliminado exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.deleteExtrasMaarLab:', error);
      throw error;
    }
  }

  /**
   * Reserva un paquete de vuelo agregando información de pasajeros usando la API de MaarLab Oceanflights
   * @param bookPackageDto - Datos para reservar el paquete (pasajeros, pago, etc.)
   * @param info - Nivel de detalle de la respuesta
   * @returns Información de la reserva/prebooking
   */
  async bookPackageMaarLab(
    agenciaId: Types.ObjectId,
    bookPackageDto: BookPackageDto,
    info: string = 'all',
  ): Promise<any> {
    try {
      this.logger.log('Iniciando reserva de paquete en MaarLab...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(bookPackageDto).substring(0, 200)}...`);
      this.logger.log(`Info: ${info}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.bookPackage(
        bearer,
        bookPackageDto,
        info,
      );
      
      this.logger.log('Paquete reservado exitosamente en VuelosService');

      // Persistir info de la reserva de vuelo en Mongo (interno).
      // Requisito: se envía `reservaChatbotId` para identificar en qué documento de `Reserva` guardar.
      const reservaChatbotId = bookPackageDto?.reservaChatbotId;
      if (reservaChatbotId) {
        const reservaDoc = await this.reservasModel.findOne({
          reservaChatbotId: String(reservaChatbotId),
        });

        if (!reservaDoc) {
          throw new NotFoundException(
            `Reserva no encontrada para reservaChatbotId=${reservaChatbotId}`,
          );
        }

        // Guardamos toda la respuesta de MaarLab, excepto el objeto "hotel".
        const vueloRespuesta =
          result && typeof result === 'object' ? { ...result } : { value: result };
        const { hotel, ...resto } = vueloRespuesta as Record<string, any>;

        reservaDoc.vuelo = reservaDoc.vuelo ?? [];
        reservaDoc.vuelo.push({
          packageId: bookPackageDto?.packageId || '',
          respuestaMaarLab: resto,
          createdAt: new Date(),
        });

        await reservaDoc.save();
      } else {
        throw new BadRequestException(
          'reservaChatbotId es requerido para persistir el vuelo en Mongo',
        );
      }

      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.bookPackageMaarLab:', error);
      throw error;
    }
  }

  /**
   * Obtiene el token de pago para un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete para obtener el token de pago
   * @param paymentType - Tipo de pago (opcional)
   * @param deferredPaymentDate - Fecha de pago diferido (opcional)
   * @returns Token de pago
   */
  async getTokenPaymentMaarLab(
    agenciaId: Types.ObjectId,
    packageId: string,
    paymentType?: string,
    deferredPaymentDate?: string,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de token de pago en MaarLab...');
      this.logger.log(
        `Package ID: ${packageId}, Payment Type: ${paymentType}, Deferred Date: ${deferredPaymentDate}`
      );
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.getTokenPayment(
        bearer,
        packageId,
        paymentType,
        deferredPaymentDate,
      );
      
      this.logger.log('Token de pago obtenido exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.getTokenPaymentMaarLab:', error);
      throw error;
    }
  }

  /**
   * Obtiene los detalles completos de un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete a obtener
   * @param info - Nivel de detalle de la respuesta
   * @returns Detalles completos del paquete
   */
  async getPackageMaarLab(
    agenciaId: Types.ObjectId,
    packageId: string,
    info: string = 'all',
  ): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de detalles de paquete en MaarLab...');
      this.logger.log(`Package ID: ${packageId}, Info: ${info}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.getPackage(bearer, packageId, info);
      
      this.logger.log('Detalles de paquete obtenidos exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.getPackageMaarLab:', error);
      throw error;
    }
  }

  /**
   * Obtiene el contrato de factura ATOL para un paquete específico usando la API de MaarLab Oceanflights
   * @param packageId - ID del paquete para obtener el contrato ATOL
   * @returns Contrato de factura ATOL
   */
  async getInvoiceATOLContractMaarLab(
    agenciaId: Types.ObjectId,
    packageId: string,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de contrato ATOL en MaarLab...');
      this.logger.log(`Package ID: ${packageId}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.getInvoiceATOLContract(
        bearer,
        packageId,
      );
      
      this.logger.log('Contrato ATOL obtenido exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.getInvoiceATOLContractMaarLab:', error);
      throw error;
    }
  }

  /**
   * Crea hoteles con configuración por defecto usando la API de MaarLab Oceanflights
   * @param completeProcessDto - Datos del hotel a crear
   * @returns Información del hotel creado o actualizado
   */
  async searchEngineCompleteProcessMaarLab(
    agenciaId: Types.ObjectId,
    completeProcessDto: any,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando creación de hotel en MaarLab...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(completeProcessDto).substring(0, 200)}...`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.searchEngineCompleteProcess(
        bearer,
        completeProcessDto,
      );
      
      this.logger.log('Hotel creado/actualizado exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.searchEngineCompleteProcessMaarLab:', error);
      throw error;
    }
  }

  /**
   * Crea agencias de viajes con configuración por defecto usando la API de MaarLab Oceanflights
   * @param completeProcessDto - Datos de la agencia de viajes a crear
   * @returns Información de la agencia de viajes creada o actualizada
   */
  async travelAgencyCompleteProcessMaarLab(
    agenciaId: Types.ObjectId,
    completeProcessDto: any,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando creación de agencia de viajes en MaarLab...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(completeProcessDto).substring(0, 200)}...`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.travelAgencyCompleteProcess(
        bearer,
        completeProcessDto,
      );
      
      this.logger.log('Agencia de viajes creada/actualizada exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.travelAgencyCompleteProcessMaarLab:', error);
      throw error;
    }
  }

  /**
   * Crea agencias de viajes usando el endpoint MaarLab V1
   * Ruta externa: /v1/travel_agency/complete_process
   * @param completeProcessDto - Datos de la agencia de viajes a crear
   * @returns Información de la agencia de viajes creada o actualizada
   */
  async travelAgencyCompleteProcessMaarLabV1(
    agenciaId: Types.ObjectId,
    completeProcessDto: any,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando creación de agencia de viajes en MaarLab V1...');
      this.logger.log(`Request recibido en VuelosService: ${JSON.stringify(completeProcessDto).substring(0, 200)}...`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.travelAgencyCompleteProcessV1(
        bearer,
        completeProcessDto,
      );
      
      this.logger.log('Agencia de viajes creada/actualizada exitosamente en VuelosService (MaarLab V1)');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.travelAgencyCompleteProcessMaarLabV1:', error);
      throw error;
    }
  }

  /**
   * Obtiene el external ID de un hotel desde el ID interno de Oceanflight usando la API de MaarLab Oceanflights
   * @param idSearchEngine - ID interno del search engine (Oceanflight)
   * @returns External ID del hotel
   */
  async mappingExternalIdSearchEngineMaarLab(
    agenciaId: Types.ObjectId,
    idSearchEngine: string,
  ): Promise<any> {
    try {
      this.logger.log('Iniciando obtención de external ID en MaarLab...');
      this.logger.log(`ID Search Engine: ${idSearchEngine}`);
      const bearer = await this.bearerMaarLab(agenciaId);
      const result = await this.maarlabService.mappingExternalIdSearchEngine(
        bearer,
        idSearchEngine,
      );
      
      this.logger.log('External ID obtenido exitosamente en VuelosService');
      return result;
    } catch (error) {
      this.logger.error('Error en VuelosService.mappingExternalIdSearchEngineMaarLab:', error);
      throw error;
    }
  }
}
