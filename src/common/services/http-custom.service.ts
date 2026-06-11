import { Injectable } from '@nestjs/common';

import { AutocoreClient } from 'src/autocore/autocore.client';
import {
  ICreateAgenciaBody,
  ICreatePaymentLinkBody,
  IdisponibilidadLayout,
  IreservaInfo,
  IreservaInfoBd,
  reservaAutocoreUpdate,
  ValidCities,
} from 'src/autocore/interfaces';
import { CobreClient } from 'src/cobre/cobre.client';
import { MetadataLinkPago } from 'src/cobre/interfaces';

/**
 * @deprecated Fachada temporal (PR-2.2 de la Fase 2). La lógica vive ahora en
 * `AutocoreClient` (src/autocore) y `CobreClient` (src/cobre); este servicio
 * conserva TODAS las firmas públicas originales y delega método a método.
 * PR-2.8 migra los consumidores a los clientes y elimina esta fachada.
 */
@Injectable()
export class HttpCustomService {
  constructor(
    private readonly autocoreClient: AutocoreClient,
    private readonly cobreClient: CobreClient,
  ) {}

  // #region Cobre

  /** @deprecated Usar `CobreClient` (interno de los métodos Cobre). */
  public async generateAuthToken() {
    // generateAuthToken es privado en CobreClient; acceso por índice para
    // conservar la firma pública original de la fachada sin exponerlo.
    return this.cobreClient['generateAuthToken']();
  }

  /** @deprecated Usar `CobreClient.createBolcillo`. */
  public async createBolcillo(nombre: string) {
    return this.cobreClient.createBolcillo(nombre);
  }

  /** @deprecated Usar `CobreClient.createCounterParty` (huérfano, riesgo R7). */
  public async createCounterParty(
    nombre: string,
    email: string,
    document: string,
    documentType: string,
    telefono: string,
  ) {
    return this.cobreClient.createCounterParty(
      nombre,
      email,
      document,
      documentType,
      telefono,
    );
  }

  /** @deprecated Usar `CobreClient.generatePaymenLink` (huérfano, riesgo R7). */
  public async generatePaymenLink(
    source_id: string,
    destination_id: string,
    amount: number,
    metadata: MetadataLinkPago,
    external_id: string,
  ) {
    return this.cobreClient.generatePaymenLink(
      source_id,
      destination_id,
      amount,
      metadata,
      external_id,
    );
  }

  // #region Autocore

  /** @deprecated Usar `AutocoreClient.getDisponibilidadAutocore`. */
  public async getDisponibilidadAutocore(
    layout: IdisponibilidadLayout[],
    checkin: string,
    night: number,
    city: ValidCities,
    tipoAgencia: number,
    dev?: boolean,
  ) {
    return this.autocoreClient.getDisponibilidadAutocore(
      layout,
      checkin,
      night,
      city,
      tipoAgencia,
      dev,
    );
  }

  /** @deprecated Usar `AutocoreClient.getDisponibilidadPersonas`. */
  public async getDisponibilidadPersonas(
    hotelId: string,
    checkin: string,
    nights: number,
    adults: number,
    childrenAges?: string,
    roomType?: string,
    dev?: boolean,
  ) {
    return this.autocoreClient.getDisponibilidadPersonas(
      hotelId,
      checkin,
      nights,
      adults,
      childrenAges,
      roomType,
      dev,
    );
  }

  /** @deprecated Usar `AutocoreClient.createReservaAutocore`. */
  public async createReservaAutocore(
    hotelId: string,
    reservaInfo: IreservaInfo,
  ) {
    return this.autocoreClient.createReservaAutocore(hotelId, reservaInfo);
  }

  /** @deprecated Usar `AutocoreClient.createReservaPersonasAutocore`. */
  public async createReservaPersonasAutocore(
    hotelId: string,
    reservation: IreservaInfoBd,
  ) {
    return this.autocoreClient.createReservaPersonasAutocore(
      hotelId,
      reservation,
    );
  }

  /** @deprecated Usar `AutocoreClient.editarReservas`. */
  public async editarReservas(
    chatbotId: string,
    reservation: reservaAutocoreUpdate,
  ) {
    return this.autocoreClient.editarReservas(chatbotId, reservation);
  }

  /** @deprecated Usar `AutocoreClient.cancelarReservas`. */
  public async cancelarReservas(chatbotId: string) {
    return this.autocoreClient.cancelarReservas(chatbotId);
  }

  /** @deprecated Usar `AutocoreClient.crearAgenciaAutocore`. */
  public async crearAgenciaAutocore(createAgenciaBody: ICreateAgenciaBody) {
    return this.autocoreClient.crearAgenciaAutocore(createAgenciaBody);
  }

  /** @deprecated Usar `AutocoreClient.setLimiteRecargaAgencia`. */
  public async setLimiteRecargaAgencia(
    id: number,
    min_recharge_amount: number,
    max_recharge_amount: number,
  ) {
    return this.autocoreClient.setLimiteRecargaAgencia(
      id,
      min_recharge_amount,
      max_recharge_amount,
    );
  }

  /** @deprecated Usar `AutocoreClient.createLinkPagoAutocore`. */
  public async createLinkPagoAutocore(
    createPaymentLinkBody: ICreatePaymentLinkBody,
  ) {
    return this.autocoreClient.createLinkPagoAutocore(createPaymentLinkBody);
  }

  /** @deprecated Usar `AutocoreClient.createLinkPagoPersonasAutocore`. */
  public async createLinkPagoPersonasAutocore(
    hotelId: number,
    guestName: string,
    email: string,
    phone: string,
    amount: number,
    bookingDates: string,
    description: string,
    currency = 'COP',
    externalRefId?: string,
    reservationId?: string, // Opcional: ID de reserva si ya existe
  ) {
    return this.autocoreClient.createLinkPagoPersonasAutocore(
      hotelId,
      guestName,
      email,
      phone,
      amount,
      bookingDates,
      description,
      currency,
      externalRefId,
      reservationId,
    );
  }

  /** @deprecated Usar `AutocoreClient.pagoBalanceAutocore`. */
  public async pagoBalanceAutocore(code: string) {
    return this.autocoreClient.pagoBalanceAutocore(code);
  }

  /** @deprecated Usar `AutocoreClient.pagoReservaBalanceAutocore` (huérfano, riesgo R7). */
  public async pagoReservaBalanceAutocore(
    createPaymentLinkBody: ICreatePaymentLinkBody,
  ) {
    return this.autocoreClient.pagoReservaBalanceAutocore(
      createPaymentLinkBody,
    );
  }

  /** @deprecated Usar `AutocoreClient.recargarCarteraAutocore`. */
  public async recargarCarteraAutocore(
    amount: number,
    currency: string,
    agency_id: number,
  ) {
    return this.autocoreClient.recargarCarteraAutocore(
      amount,
      currency,
      agency_id,
    );
  }

  /** @deprecated Usar `AutocoreClient.reembolsoCartera`. */
  public async reembolsoCartera(
    idLink: string,
    agenciaId: number,
    chatbotId: string,
  ) {
    return this.autocoreClient.reembolsoCartera(idLink, agenciaId, chatbotId);
  }

  /** @deprecated Usar `AutocoreClient.obtenerSaldoCartera`. */
  public async obtenerSaldoCartera(agency_id: number) {
    return this.autocoreClient.obtenerSaldoCartera(agency_id);
  }
}
