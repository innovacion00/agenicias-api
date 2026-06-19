import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { format } from '@formkit/tempo';

import { ErrorManager } from 'src/common/helpers';
import { SendEmailCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import {
  notificacionCancelacionToures,
  notificacionCancelacionVoluntariaReservas,
  notificacionSaldoPendienteIntentoCancelacion,
} from 'src/config';

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
import { Reserva } from './entities';
import {
  obtenerCiudadPorNombre,
  debeBloquearCancelacionPorPrimeraMitadPagada,
} from './utils';
import { LinksHistory, ValidPaymentStatus } from './interfaces';
import { CancellationTasksQueueService } from './cancellation-tasks-queue.service';
import { MyToolBookingService } from './services/my-tool-booking.service';
import { ReservasSearchService } from './services/reservas-search.service';
import { ReservasBookingService } from './services/reservas-booking.service';
import { ReservasReactivacionService } from './services/reservas-reactivacion.service';
import { LinksPagoService } from './services/links-pago.service';
import { ReservasPagosService } from './services/reservas-pagos.service';
import { ReservasEmailsService } from './services/reservas-emails.service';
import { ReservasCancelacionService } from './services/reservas-cancelacion.service';
import { ReservasCountCacheService } from './services/reservas-count-cache.service';
import {
  CancelReservaMyToolDto,
  CreateReservaMyToolDto,
} from './dto/create-reserva-mytool.dto';

@Injectable()
export class ReservasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly emailService: SendEmailCustomService,
    private readonly cancellationTasksQueueService: CancellationTasksQueueService,
    private readonly myToolBookingService: MyToolBookingService,
    private readonly reservasSearchService: ReservasSearchService,
    private readonly reservasBookingService: ReservasBookingService,
    private readonly reservasReactivacionService: ReservasReactivacionService,
    private readonly linksPagoService: LinksPagoService,
    private readonly pagosService: ReservasPagosService,
    private readonly emailsService: ReservasEmailsService,
    private readonly cancelacionService: ReservasCancelacionService,
    private readonly countCache: ReservasCountCacheService,
  ) {
    this.errorManager = new ErrorManager(ReservasService.name);
  }

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
    try {
      const reserva = await this.reservasModel.findById(reservaId).exec();
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }
      if (reserva.status === ValidPaymentStatus.cancelado) {
        throw new BadRequestException(
          'No se pueden actualizar fechas de pago en una reserva cancelada',
        );
      }

      const isSuperAdmin = user.role.includes('super-admin');
      if (
        !isSuperAdmin &&
        reserva.agenciaId.toString() !== user.agencia.toString()
      ) {
        throw new ForbiddenException(
          'No cuentas con permisos para modificar las fechas de pago de esta reserva',
        );
      }

      const checkinRaw = reserva.reservation?.checkin;
      if (!checkinRaw || typeof checkinRaw !== 'string') {
        throw new BadRequestException(
          'La reserva no tiene check-in válido para validar las fechas de pago',
        );
      }

      const checkinDate = this.parseYyyyMmDdOrThrow(checkinRaw, 'checkin');
      const fechaLimitePago = this.parseYyyyMmDdOrThrow(
        updateFechasPagoDto.fechaLimitePago,
        'fechaLimitePago',
      );
      const fechaLimitePago2 = this.parseYyyyMmDdOrThrow(
        updateFechasPagoDto.fechaLimitePago2,
        'fechaLimitePago2',
      );

      if (fechaLimitePago > checkinDate) {
        throw new BadRequestException(
          'fechaLimitePago no puede ser mayor a la fecha de check-in de la reserva',
        );
      }
      if (fechaLimitePago2 > checkinDate) {
        throw new BadRequestException(
          'fechaLimitePago2 no puede ser mayor a la fecha de check-in de la reserva',
        );
      }

      reserva.fechaLimitePago = updateFechasPagoDto.fechaLimitePago.trim();
      reserva.fechaLimitePago2 = updateFechasPagoDto.fechaLimitePago2.trim();
      await reserva.save();
      this.countCache.invalidateAll();

      return {
        reservaId: reserva._id,
        reservaChatbotId: reserva.reservaChatbotId,
        fechaLimitePago: reserva.fechaLimitePago,
        fechaLimitePago2: reserva.fechaLimitePago2,
        checkin: reserva.reservation.checkin,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  private parseYyyyMmDdOrThrow(value: string, fieldName: string): Date {
    const raw = value.trim();
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) {
      throw new BadRequestException(
        `${fieldName} inválido (se esperaba YYYY-MM-DD): ${value}`,
      );
    }

    const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(
        `${fieldName} inválido (no se pudo parsear): ${value}`,
      );
    }
    return parsed;
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
