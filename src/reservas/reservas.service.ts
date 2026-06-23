import { Injectable, Logger } from '@nestjs/common';

import { Types } from 'mongoose';

import { User } from 'src/auth/entities';

import {
  CancelReservaDto,
  CreateReservaDto,
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
  PagoReservaBilleteraDto,
  ReactivarReservaDto,
  UpdateFechasPagoDto,
  UpdateReservaDto,
} from './dto';
import { ValidPaymentStatus } from './interfaces';
import { ReservasSearchService } from './services/reservas-search.service';
import { ReservasBookingService } from './services/reservas-booking.service';
import { ReservasReactivacionService } from './services/reservas-reactivacion.service';
import { ReservasPagosService } from './services/reservas-pagos.service';
import { ReservasCancelacionService } from './services/reservas-cancelacion.service';
import {
  CancelReservaMyToolDto,
  CreateReservaMyToolDto,
} from './dto/create-reserva-mytool.dto';

@Injectable()
export class ReservasService {
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    private readonly reservasSearchService: ReservasSearchService,
    private readonly reservasBookingService: ReservasBookingService,
    private readonly reservasReactivacionService: ReservasReactivacionService,
    private readonly pagosService: ReservasPagosService,
    private readonly cancelacionService: ReservasCancelacionService,
  ) {}

  // #region Crear reserva
  async createReserva(
    createReservaDto: CreateReservaDto,
    hotelId: string,
    userId: string,
  ) {
    return this.reservasBookingService.createReserva(
      createReservaDto,
      hotelId,
      userId,
    );
  }

  // #region generar link de pago
  async generarLinkPago(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    return this.pagosService.generarLinkPago(generateLinkDto, agencia);
  }

  // #region Pago billetera
  async realizarPagoBilletera(
    pagoReservaBilleteraDto: PagoReservaBilleteraDto,
  ) {
    return this.pagosService.realizarPagoBilletera(pagoReservaBilleteraDto);
  }

  async pagarAutocoreBalanceReserva(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    return this.pagosService.pagarAutocoreBalanceReserva(
      generateLinkDto,
      agencia,
    );
  }

  // #region editar reserva
  async editarReserva(
    reservaId: Types.ObjectId,
    updateReservaDto: UpdateReservaDto,
    user: User,
  ) {
    return this.reservasBookingService.editarReserva(
      reservaId,
      updateReservaDto,
      user,
    );
  }

  // #region Cancelar reserva agencia
  async cancelarReserva(cancelReservaDto: CancelReservaDto, user: User) {
    return this.cancelacionService.cancelarReserva(cancelReservaDto, user);
  }

  // #region Cambiar estado de la reserva autocore
  async cambiarEstadoPagoAutocore(payload: {
    external_ref_id: string;
    transaction_id?: string;
    payment_status: string;
    details: {
      id: string;
      pay_platform?: string;
    };
  }) {
    return this.pagosService.cambiarEstadoPagoAutocore(payload);
  }

  // #region Obtener reservas por usuario
  async getReservasByUser(userId: Types.ObjectId | string, page = 1) {
    return this.reservasSearchService.getReservasByUser(userId, page);
  }

  // #region Búsquedas de reservas
  //? Buscar reserva por reservaChatbotId
  // Nota: reservaChatbotId es único, por lo tanto la búsqueda es exacta
  // No requiere paginación porque siempre retorna 0 o 1 resultado
  async buscarPorChatbotId(
    reservaChatbotId: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
  ) {
    return this.reservasSearchService.buscarPorChatbotId(
      reservaChatbotId,
      userId,
      agenciaId,
      roles,
    );
  }

  //? Buscar reservas por nombre del agente
  async buscarPorNombreAgente(
    nombreAgente: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ) {
    return this.reservasSearchService.buscarPorNombreAgente(
      nombreAgente,
      userId,
      agenciaId,
      roles,
      page,
      all,
    );
  }

  //? Buscar reservas por nombre de agencia
  async buscarPorNombreAgencia(
    nombreAgencia: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ) {
    return this.reservasSearchService.buscarPorNombreAgencia(
      nombreAgencia,
      userId,
      agenciaId,
      roles,
      page,
      all,
    );
  }

  //? Buscar reservas por nombre del huésped
  async buscarPorNombreHuesped(
    nombreHuesped: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ) {
    return this.reservasSearchService.buscarPorNombreHuesped(
      nombreHuesped,
      userId,
      agenciaId,
      roles,
      page,
      all,
    );
  }

  //? Buscar reservas por estado
  async buscarPorEstado(
    status: ValidPaymentStatus,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ) {
    return this.reservasSearchService.buscarPorEstado(
      status,
      userId,
      agenciaId,
      roles,
      page,
      all,
    );
  }

  // #region Obtener reservas por agencia
  async getReservasByAgencia(agenciaId: Types.ObjectId, page = 1) {
    return this.reservasSearchService.getReservasByAgencia(agenciaId, page);
  }

  // #region Disponibilidad
  async getDisponibilidad(
    agenciaId: Types.ObjectId,
    disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    return this.reservasBookingService.getDisponibilidad(
      agenciaId,
      disponibilidadAutoCoreDto,
    );
  }

  // #region Administracion
  //? Obtener todas las reservas
  async getAllReservas(
    page = 1,
    all = false,
    hotel?: string,
    nombreAgencia?: string,
    fechaDesde?: string,
    fechaHasta?: string,
  ) {
    return this.reservasSearchService.getAllReservas(
      page,
      all,
      hotel,
      nombreAgencia,
      fechaDesde,
      fechaHasta,
    );
  }

  //? Cancelar reservas
  async cancelarReservaAdmin(reservaId: Types.ObjectId) {
    return this.cancelacionService.cancelarReservaAdmin(reservaId);
  }

  async actualizarStatusReservaManual(
    reservaId: Types.ObjectId | string,
    status: ValidPaymentStatus,
    saltarValidacionCheckin = false,
    forzarCancelacionConPagoMitad = false,
  ) {
    return this.pagosService.actualizarStatusReservaManual(
      reservaId,
      status,
      saltarValidacionCheckin,
      forzarCancelacionConPagoMitad,
    );
  }

  async actualizarFechasPagoReserva(
    reservaId: Types.ObjectId,
    updateFechasPagoDto: UpdateFechasPagoDto,
    user: User,
  ) {
    return this.pagosService.actualizarFechasPagoReserva(
      reservaId,
      updateFechasPagoDto,
      user,
    );
  }

  // #region MyTool Booking

  async getMyToolMappings(hotelSlug: string) {
    return this.reservasBookingService.getMyToolMappings(hotelSlug);
  }

  async createReservaMyTool(
    dto: CreateReservaMyToolDto,
    hotelSlug: string,
    userId: string,
  ) {
    return this.reservasBookingService.createReservaMyTool(
      dto,
      hotelSlug,
      userId,
    );
  }

  async cancelarReservaMyTool(dto: CancelReservaMyToolDto, user: User) {
    return this.cancelacionService.cancelarReservaMyTool(dto, user);
  }

  async searchReservaMyTool(
    hotelSlug: string,
    localizador: string,
    nombre: string,
  ) {
    return this.reservasSearchService.searchReservaMyTool(
      hotelSlug,
      localizador,
      nombre,
    );
  }

  // #endregion MyTool Booking

  // #region Reactivación de reservas canceladas
  async reactivarReservaCancelada(
    reactivarReservaDto: ReactivarReservaDto,
    user: User,
  ) {
    return this.reservasReactivacionService.reactivarReservaCancelada(
      reactivarReservaDto,
      user,
    );
  }
  // #endregion Reactivación de reservas canceladas
}
