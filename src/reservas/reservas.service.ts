import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel, InjectConnection } from '@nestjs/mongoose';

import { randomBytes } from 'crypto';
import { Model, Types, Connection } from 'mongoose';

import { addDay, format, addMinute } from '@formkit/tempo';
import { isNotEmptyObject } from 'class-validator';

import { ErrorManager } from 'src/common/helpers';
import { HttpCustomService, SendEmailCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import {
  hotelesAutocore,
  hotelesAutocorePaymenLink,
  notificacionCancelacionToures,
  notificacionCancelacionVoluntariaReservas,
  notificacionReactivacionPagoFallido,
  notificacionSaldoPendienteIntentoCancelacion,
  notificacionToures,
  notificacionTransporte,
  notificaiconReservaGrupo,
  tiposAgencia,
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
  calcularFechaLimitePago,
  obtenerCiudadPorNombre,
  obtenerHotelIdPorNombre,
  debeBloquearCancelacionPorPrimeraMitadPagada,
} from './utils';
import { LinksHistory, ValidPaymentStatus } from './interfaces';
import { CancellationTasksQueueService } from './cancellation-tasks-queue.service';
import { MyToolBookingService } from './services/my-tool-booking.service';
import { ReservasSearchService } from './services/reservas-search.service';
import { ValidRoles } from 'src/auth/interfaces';
import {
  CancelReservaMyToolDto,
  CreateReservaMyToolDto,
} from './dto/create-reserva-mytool.dto';
import { hotelMyToolConfig } from 'src/config/constants/myToolBookingConstants';

@Injectable()
export class ReservasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly emailService: SendEmailCustomService,
    private readonly httpCustomService: HttpCustomService,
    private readonly cancellationTasksQueueService: CancellationTasksQueueService,
    private readonly myToolBookingService: MyToolBookingService,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly reservasSearchService: ReservasSearchService,
  ) {
    this.errorManager = new ErrorManager(ReservasService.name);
  }

  // #region Crear reserva
  async createReserva(
    createReservaDto: CreateReservaDto,
    hotelId: string,
    userId: string,
  ) {
    const cantidadHabitacion =
      createReservaDto.reservaInfo.reservation.roomsData.length;
    try {
      createReservaDto.reservaInfo.agency.agency_type =
        createReservaDto.reservaInfo.agency.agency_type === 1
          ? tiposAgencia.mayorista
          : tiposAgencia.minorista;

      let planAlimentario = '';

      // Determinar si es reserva de grupo (10 o más habitaciones)
      const isReservaGrupo =
        createReservaDto.reservaInfo.reservation.roomsData.length >= 10;

      const userInfo = await this.userModel
        .findById(userId)
        .populate('agencia', 'fullName');

      if (!userInfo) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (!userInfo.agencia || typeof userInfo.agencia === 'string') {
        throw new BadRequestException('Información de agencia no disponible');
      }

      // Calcular fechas límite (regla especial por agencia en calcularFechaLimitePago)
      const fechasLimite = calcularFechaLimitePago(
        createReservaDto.reservaInfo.reservation.checkin,
        isReservaGrupo,
        userInfo.agencia._id,
      );

      const { fechaLimitePago, fechaLimitePago2 } = fechasLimite;

      createReservaDto.reservaInfo.reservation.source_of_bussiness =
        'Booking Connect';

      const rootNotes =
        typeof createReservaDto.notes === 'string'
          ? createReservaDto.notes.trim()
          : '';
      if (rootNotes) {
        const { reservation } = createReservaDto.reservaInfo;
        const inner = reservation.notes?.trim() ?? '';
        reservation.notes = inner ? `${inner}\n${rootNotes}` : rootNotes;
      }

      const reservaAutocoreInfo =
        await this.httpCustomService.createReservaAutocore(
          hotelId,
          createReservaDto.reservaInfo,
        );

      if (!reservaAutocoreInfo) {
        throw new InternalServerErrorException(
          'Error al crear reserva en Autocore',
        );
      }

      if (reservaAutocoreInfo.no_available_rooms) {
        throw new ConflictException(reservaAutocoreInfo.msg);
      }

      const retenciones: {
        reteFuente?: CreateReservaDto['reteFuente'];
        reteIca?: CreateReservaDto['reteIca'];
        reteIva?: CreateReservaDto['reteIva'];
      } = {};
      if (createReservaDto.reteFuente) {
        retenciones.reteFuente = createReservaDto.reteFuente;
      }

      if (createReservaDto.reteIca) {
        retenciones.reteIca = createReservaDto.reteIca;
      }

      if (createReservaDto.reteIva) {
        retenciones.reteIva = createReservaDto.reteIva;
      }

      if (createReservaDto.planAlimentario) {
        planAlimentario = createReservaDto.planAlimentario;
      }

      const hotelInfo =
        hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
      if (!hotelInfo) {
        throw new BadRequestException(`Hotel con ID ${hotelId} no encontrado`);
      }

      // Usar transacción para asegurar consistencia
      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        const [reserva] = await this.reservasModel.create(
          [
            {
              hotel: hotelInfo.name,
              agenciaId: userInfo.agencia._id,
              userId,
              cantidadHabitaciones:
                createReservaDto.reservaInfo.reservation.roomsData.length,
              total: createReservaDto.total,
              totalMitad: createReservaDto.total / 2,
              reservation: createReservaDto.reservaInfo.reservation,
              reservaChatbotId: reservaAutocoreInfo.chatbot_id,
              titularInfo: createReservaDto.titularInfo,
              fechaLimitePago,
              fechaLimitePago2,
              exentoIva: createReservaDto.exentoIva
                ? createReservaDto.exentoIva
                : false,
              ...retenciones,
              planAlimentario,
              adicionCena: createReservaDto.adicionCena || false,
              adicionAlmuerzo: createReservaDto.adicionAlmuerzo || false,
              infoTransporte: createReservaDto.infoTransporte || null,
              infoToures: createReservaDto.infoToures || null,
              mascotas: createReservaDto.mascotas,
              mascotasNumber: createReservaDto.mascotasNumber,
              origenIata: createReservaDto.origenIata,
            },
          ],
          { session },
        );

        userInfo.reservas.push(reserva._id as Types.ObjectId);
        await userInfo.save({ session });

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }

      if (
        createReservaDto.infoTransporte &&
        userInfo.agencia &&
        typeof userInfo.agencia === 'object' &&
        'fullName' in userInfo.agencia &&
        userInfo.agencia.fullName !== 'geh suites'
      ) {
        const hotelInfo =
          hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
        if (!hotelInfo) {
          throw new BadRequestException(
            `Hotel con ID ${hotelId} no encontrado`,
          );
        }
        const { name, city } = hotelInfo;
        const { tipoRecogida } = createReservaDto.infoTransporte;
        const contactInfo =
          city === 'Santa marta'
            ? {
                email: 'reservasgocolombia@gmail.com',
                tel: '+57 304 3697601',
              }
            : city === 'Bogota'
              ? name === 'Hotel Windsor'
                ? {
                    email: [
                      'reservas.zonanglobal@gmail.com',
                      'recepcion@hotelwindsorhouse.com',
                    ],
                    tel: '+57 333 6025021',
                  }
                : {
                    email: [
                      'reservas.zonanglobal@gmail.com',
                      'recepcionmadisson@gmail.com',
                    ],
                    tel: '+57 333 6025021',
                  }
              : {
                  email: 'operadortour2025@gmail.com',
                  tel: '+57 304 3697601',
                };

        const textTipoRecogida =
          tipoRecogida === 0
            ? `Servicio de traslado desde el a`
            : tipoRecogida === 1
              ? `Servicio de traslado de ${name} a aeropuerto`
              : `Servicio de traslado de aeropueto a ${name} y salida del ${name} al aeropuerto`;

        await this.emailService
          .sendEmail(
            contactInfo.email,
            `Solictud de servicio de translado para Geh Suites hotels`,
            notificacionTransporte(
              textTipoRecogida,
              createReservaDto.reservaInfo.reservation.checkin,
              createReservaDto.reservaInfo.reservation.checkout,
              createReservaDto.infoTransporte.cantidadPersonas,
              createReservaDto.infoTransporte.firstContactNumber,
              createReservaDto.infoTransporte.aerolinea,
              createReservaDto.infoTransporte.numeroVuelo,
              `${createReservaDto.reservaInfo.reservation.firstName} ${createReservaDto.reservaInfo.reservation.lastName}`,
              contactInfo.tel,
              createReservaDto.infoTransporte.numeroVueloSalida,
              createReservaDto.infoTransporte.secondContacNumber,
            ),
          )
          .catch((error) => {
            this.logger.error(error);
          });
      }

      if (
        createReservaDto.infoToures &&
        userInfo.agencia &&
        typeof userInfo.agencia === 'object' &&
        'fullName' in userInfo.agencia &&
        userInfo.agencia.fullName !== 'geh suites'
      ) {
        const hotelInfo =
          hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
        if (!hotelInfo) {
          throw new BadRequestException(
            `Hotel con ID ${hotelId} no encontrado`,
          );
        }
        const { name, city } = hotelInfo;
        const email =
          city === 'Santa marta'
            ? 'reservasgocolombia@gmail.com'
            : 'operadortour2025@gmail.com';

        await this.emailService
          .sendEmail(
            email,
            `Solictud de servicio de toures para Geh Suites hotels`,
            notificacionToures(
              createReservaDto.infoToures.nombres,
              name,
              createReservaDto.infoToures.firstContactNumber,
              `${createReservaDto.reservaInfo.reservation.firstName} ${createReservaDto.reservaInfo.reservation.lastName}`,
              Number(createReservaDto.reservaInfo.reservation.adults) +
                Number(createReservaDto.reservaInfo.reservation.children) || 0,
              createReservaDto.infoToures.secondContacNumber,
            ),
          )
          .catch((error) => {
            this.logger.error(error);
          });
      }

      if (cantidadHabitacion >= 10) {
        await this.emailService
          .sendEmail(
            'reservas@gehsuites.com',
            `Reserva para grupo de ${cantidadHabitacion} para agencia ${
              userInfo.agencia &&
              typeof userInfo.agencia === 'object' &&
              'fullName' in userInfo.agencia
                ? userInfo.agencia.fullName
                : 'Agencia desconocida'
            }`,
            notificaiconReservaGrupo(
              userInfo.agencia &&
                typeof userInfo.agencia === 'object' &&
                'fullName' in userInfo.agencia
                ? (userInfo.agencia.fullName as string)
                : 'Agencia desconocida',
              cantidadHabitacion,
              hotelInfo.name,
              createReservaDto.reservaInfo.reservation.checkin,
              createReservaDto.reservaInfo.reservation.checkout,
              reservaAutocoreInfo.chatbot_id,
            ),
          )
          .catch((error) => {
            this.logger.error(error);
          });
      }

      return {
        ...createReservaDto,
        reservaChatbotId: reservaAutocoreInfo.chatbot_id,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region generar link de pago
  private async buildLinkPagoForReserva(
    reservaInfo: Reserva,
    agenciaInfo: Agencia,
    pagoTotal: boolean,
  ) {
    const hotel = reservaInfo.hotel;
    const external_id = `${reservaInfo._id}${pagoTotal ? ' pagoTotal' : ''}`;

    const linkAutocore = await this.httpCustomService.createLinkPagoAutocore({
      currency: reservaInfo.reservation.currency,
      agency_id: agenciaInfo.autocoreInfo.id,
      amount: pagoTotal ? reservaInfo.total : reservaInfo.totalMitad,
      available_hours: 0.1666,
      booking_dates: `${reservaInfo.reservation.checkin} - ${reservaInfo.reservation.checkout}`,
      description: `Pago para reserva ${reservaInfo.reservaChatbotId} de ${reservaInfo.reservation.nights} noches en ${hotel}`,
      email: agenciaInfo.emailContacto,
      external_ref_id: external_id,
      guest_name: agenciaInfo.fullName,
      hotel_id:
        hotelesAutocorePaymenLink[
          hotel as keyof typeof hotelesAutocorePaymenLink
        ] || 0,
      phone: agenciaInfo.telefonoContacto,
      redirect: {
        failure_url: 'https://agencia.gehsuites.com/misreservas',
        success_url: 'https://agencia.gehsuites.com/misreservas',
      },
      source: 'Booking Connect',
      temp_webhook_url:
        'https://gehsuitesapps.com/agencias/v1/reservas/change-status',
      reservation_id: reservaInfo.reservaChatbotId,
    });

    if (!linkAutocore) {
      throw new InternalServerErrorException('Error al generar link de pago');
    }

    return {
      link: linkAutocore.url,
      expirationDate: addMinute(new Date(), 5),
      idLinkPago: linkAutocore.code,
    };
  }

  async generarLinkPago(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    try {
      const agenciaInfo = await this.agenciaModel.findById(agencia).exec();
      const reservaInfo = await this.reservasModel.findById(
        generateLinkDto.reservaId,
      );

      if (
        !reservaInfo ||
        reservaInfo.status === 4 ||
        reservaInfo.status === 3
      ) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (!agenciaInfo) {
        throw new NotFoundException('Agencia no encontrada');
      }

      const pagoTotal = generateLinkDto.pagoTotal ?? false;
      const linkInfo = await this.buildLinkPagoForReserva(
        reservaInfo,
        agenciaInfo,
        pagoTotal,
      );

      if (pagoTotal) {
        await reservaInfo.updateOne({
          $set: { linkInfo, pagadoPrimeraMitad: pagoTotal },
        });
      } else {
        await reservaInfo.updateOne({
          $set: { linkInfo },
        });
      }

      reservaInfo.status = 1;
      await reservaInfo.save();

      return { linkInfo };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Pago billetera
  async realizarPagoBilletera(
    pagoReservaBilleteraDto: PagoReservaBilleteraDto,
  ) {
    try {
      const data = await this.httpCustomService.pagoBalanceAutocore(
        pagoReservaBilleteraDto.code,
      );
      return data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async pagarAutocoreBalanceReserva(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    try {
      const linkDoc = await this.generarLinkPago(generateLinkDto, agencia);

      const pagoBalanceInfo = await this.realizarPagoBilletera({
        code: linkDoc.linkInfo.idLinkPago,
      });

      return pagoBalanceInfo;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region editar reserva
  async editarReserva(
    reservaId: Types.ObjectId,
    updateReservaDto: UpdateReservaDto,
    user: User,
  ) {
    try {
      if (!isNotEmptyObject(updateReservaDto)) {
        throw new BadRequestException('Cuerpo de peticion invalido');
      }

      const reserva = await this.reservasModel.findById(reservaId);

      if (!reserva || reserva.status === 4) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (
        !user.reservas.includes(reservaId) &&
        !user.role.includes('super-admin')
      ) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para editar esta reserva',
        );
      }

      const titularInfoUpdates = reserva.titularInfo;
      const reservationUpdates = reserva.reservation;

      const updateReservaDtoFields = Object.keys(updateReservaDto) as Array<
        keyof UpdateReservaDto
      >;

      for (const field of updateReservaDtoFields) {
        const value = updateReservaDto[field];
        if (value !== undefined && field in titularInfoUpdates) {
          (titularInfoUpdates as Record<string, any>)[field] = value;
        }

        if (value !== undefined && field in reservationUpdates) {
          (reservationUpdates as Record<string, any>)[field] = value;
        }
      }

      /** Reservas solo-MyTool: el chatbotId es localizador My Tool; no existe en Autocore → 404 si se hace PUT allí. */
      let data: { msg: string };
      if (reserva.reservaProvider === 'mytool') {
        this.logger.warn(
          `editarReserva: reserva ${reserva.reservaChatbotId} es mytool — sin PUT Autocore; actualización solo en BD.`,
        );
        data = {
          msg: 'Datos actualizados en la base de datos. Esta reserva está en My Tool; los cambios no se replican en Autocore.',
        };
      } else {
        const autocoreData = await this.httpCustomService.editarReservas(
          reserva.reservaChatbotId,
          updateReservaDto,
        );
        if (!autocoreData) {
          throw new InternalServerErrorException(
            'No se recibió respuesta de Autocore al editar la reserva.',
          );
        }
        data = autocoreData;
      }

      await reserva.updateOne({
        $set: {
          titularInfo: titularInfoUpdates,
          reservation: reservationUpdates,
          notasSuperAdmin: updateReservaDto.notasSuperAdmin
            ? updateReservaDto.notasSuperAdmin
            : reserva.notasSuperAdmin,
          notasagencias: updateReservaDto.notasagencias
            ? updateReservaDto.notasagencias
            : reserva.notasagencias,
        },
      });

      return data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  private enqueuePostCancellationTasks(
    reserva: Reserva,
    agenciaDoc: Agencia,
  ): void {
    const reservaId = String(reserva._id);

    if (reserva.linksHistory) {
      for (const linkInfo of reserva.linksHistory) {
        if (
          (linkInfo.state === ValidPaymentStatus.mitad ||
            linkInfo.state === ValidPaymentStatus.total) &&
          linkInfo.id
        ) {
          this.cancellationTasksQueueService.enqueueRefundJob(reservaId, {
            idLink: linkInfo.id,
            agenciaId: agenciaDoc.autocoreInfo.id,
            chatbotId: reserva.reservaChatbotId,
          });
        }
      }
    }

    const saldoFavor =
      reserva.status !== ValidPaymentStatus.total
        ? reserva.totalMitad
        : reserva.total;

    const mensajeReserva = notificacionCancelacionVoluntariaReservas(
      reserva.reservaChatbotId,
      agenciaDoc.fullName,
      reserva.pagadoPrimeraMitad,
      saldoFavor,
    );

    this.cancellationTasksQueueService.enqueueCancelEmailJob(reservaId, {
      target: 'reservas@gehsuites.com',
      subject: `Booking connect - Notificacion de cancelacion de reserva por parte de agencia ${agenciaDoc.fullName}`,
      html: mensajeReserva,
    });

    if (reserva.infoToures || reserva.infoTransporte) {
      const mensajeCancelacion = notificacionCancelacionToures(
        `${reserva.titularInfo.firstName} ${reserva.titularInfo.lastName}`,
        reserva.reservation.checkin,
        reserva.reservation.checkout,
        reserva.infoToures?.firstContactNumber ||
          reserva.infoTransporte?.firstContactNumber ||
          '',
      );

      const contactInfo =
        obtenerCiudadPorNombre(reserva.hotel) === 'Santa marta'
          ? 'reservasgocolombia@gmail.com'
          : 'operadortour2025@gmail.com';

      this.cancellationTasksQueueService.enqueueCancelTourTransportEmailJob(
        reservaId,
        {
          target: contactInfo,
          subject:
            'Booking connect - Notificacion de cancelacion de transporte o tour',
          html: mensajeCancelacion,
        },
      );
    }
  }

  private async enviarCorreoSaldoPendienteIntentoCancelacion(
    reserva: Reserva,
    recipientEmail: string,
  ): Promise<void> {
    const checkin = reserva.reservation?.checkin ?? '';
    const checkout = reserva.reservation?.checkout ?? '';
    const html = notificacionSaldoPendienteIntentoCancelacion(
      reserva.reservaChatbotId,
      checkin,
      checkout,
    );
    await this.emailService.sendEmail(
      recipientEmail,
      'Booking connect - Saldo pendiente de su reserva',
      html,
    );
  }

  // #region Cancelar reserva agencia
  async cancelarReserva(cancelReservaDto: CancelReservaDto, user: User) {
    try {
      const reserva = await this.reservasModel.findById(
        cancelReservaDto.reservaId,
      );

      const agenciaDoc = await this.agenciaModel.findById(user.agencia);

      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (!agenciaDoc) {
        throw new NotFoundException('Agencia no encontrada');
      }

      if (reserva.status === 4) {
        return {
          msg: `Reserva ${reserva.reservaChatbotId} ya esta cancelada correctamente`,
        };
      }

      if (
        !user.role.includes('admin') &&
        !user.reservas.includes(cancelReservaDto.reservaId) &&
        !user.role.includes('super-admin')
      ) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para cancelar esta reserva',
        );
      }

      if (
        reserva.agenciaId.toString() !== user.agencia.toString() &&
        !user.role.includes('super-admin')
      ) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para cancelar esta reserva',
        );
      }

      if (
        debeBloquearCancelacionPorPrimeraMitadPagada(reserva) &&
        !user.role.includes('super-admin')
      ) {
        await this.enviarCorreoSaldoPendienteIntentoCancelacion(
          reserva,
          user.email,
        );
        throw new BadRequestException(
          'No es posible cancelar esta reserva porque ya registra el pago de la primera mitad con saldo pendiente. Se envió un correo con los pasos para gestionar el pago restante.',
        );
      }

      const cancelOpId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const lockedReserva = await this.reservasModel.findOneAndUpdate(
        {
          _id: cancelReservaDto.reservaId,
          status: { $ne: ValidPaymentStatus.cancelado },
          cancelInProgress: { $ne: true },
        },
        {
          $set: {
            cancelInProgress: true,
            cancelRequestedAt: new Date(),
            cancelOpId,
          },
        },
        { new: true },
      );

      if (!lockedReserva) {
        const latest = await this.reservasModel.findById(
          cancelReservaDto.reservaId,
        );
        if (latest?.status === ValidPaymentStatus.cancelado) {
          return {
            msg: `Reserva ${latest.reservaChatbotId} ya esta cancelada correctamente`,
          };
        }

        return {
          msg: 'La cancelacion de la reserva ya esta en proceso, intenta recargar en unos segundos',
        };
      }

      try {
        const autocoreResponse = await this.httpCustomService.cancelarReservas(
          lockedReserva.reservaChatbotId,
        );

        await this.reservasModel.updateOne(
          { _id: lockedReserva._id },
          {
            $set: {
              status: ValidPaymentStatus.cancelado,
              cancelInProgress: false,
              cancelProcessedAt: new Date(),
            },
            $unset: {
              cancelOpId: '',
            },
          },
        );

        lockedReserva.status = ValidPaymentStatus.cancelado;
        this.enqueuePostCancellationTasks(lockedReserva, agenciaDoc);

        if (autocoreResponse?.alreadyCanceled) {
          return {
            msg: `Reserva ${lockedReserva.reservaChatbotId} ya estaba cancelada en Autocore y fue sincronizada localmente`,
          };
        }

        return autocoreResponse;
      } catch (error) {
        await this.reservasModel.updateOne(
          { _id: cancelReservaDto.reservaId },
          {
            $set: { cancelInProgress: false },
            $unset: { cancelOpId: '' },
          },
        );
        throw error;
      }
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
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
    if (!payload.external_ref_id) {
      this.logger.error('external_ref_id no proporcionado en payload');
      return true;
    }

    const valores = payload.external_ref_id.split(' ') as string[];
    const problemas = [
      '67ab755cedb19b9bad39f22d',
      '67ab7863edb19b9bad3a4471',
      '67cefa09a0c53ce8c5e1fb9b',
      '67bf4b1a7b358f891dce8926',
      '67c084a87b358f891dd07448',
      '67c761d2be7b7404574c2513',
    ];

    const firstValue = valores[0]?.trim();
    if (!firstValue) {
      this.logger.error(
        `${format(new Date(), '[MM/DD/YY - h:mm:ss a]', 'es')} - Error ${JSON.stringify(payload)}`,
      );
      return true;
    }

    if (problemas.includes(firstValue)) {
      return true;
    }

    const autocoreId = payload.transaction_id?.trim();
    this.logger.log(payload);

    const id = firstValue;

    let pagoValidator: string | null = null;
    if (valores[1]) {
      pagoValidator = valores[1].trim();
    }

    const reserva = await this.reservasModel.findById(id);

    if (!reserva) {
      throw new NotFoundException(`Reserva con id: ${id}`);
    }

    if (!reserva.paymenIds) {
      reserva.paymenIds = [];
    }

    if (
      reserva.status === ValidPaymentStatus.total ||
      reserva.status === ValidPaymentStatus.cancelado
    ) {
      return true;
    }

    const status = String(payload.payment_status || '')
      .trim()
      .toLowerCase();
    if (!status) {
      return true;
    }
    const paymentEventKey = autocoreId ? `${autocoreId}:${status}` : null;
    if (paymentEventKey && reserva.paymenIds.includes(paymentEventKey)) {
      return true;
    } else if (paymentEventKey) {
      reserva.paymenIds.push(paymentEventKey);
    }
    const linkDetails: LinksHistory = {
      id: payload.details.id,
      typeOfPayment: payload.details.pay_platform
        ? payload.details.pay_platform
        : 'No identificado',
      state: undefined,
      fecha: new Date(),
    };
    switch (status) {
      case 'en proceso':
        reserva.status = ValidPaymentStatus.espera;
        await reserva.save();
        return true;

      case 'rechazado':
      case 'cancelado':
      case 'tarjeta no válida':
        linkDetails.state = ValidPaymentStatus.rejected;
        reserva.linksHistory.push(linkDetails);
        if (pagoValidator) {
          reserva.pagadoPrimeraMitad = false;

          reserva.status = ValidPaymentStatus.rejected;
          await reserva.save();
          if (reserva.esReactivacion) {
            await this.handleReactivacionPagoFallido(reserva);
          }
          return true;
        }

        reserva.status = ValidPaymentStatus.rejected;
        await reserva.save();
        if (reserva.esReactivacion) {
          await this.handleReactivacionPagoFallido(reserva);
        }
        return true;

      case 'aplicado':
        if (!reserva.pagadoPrimeraMitad) {
          linkDetails.state = ValidPaymentStatus.mitad;
          reserva.linksHistory.push(linkDetails);
          reserva.status = ValidPaymentStatus.mitad;
          reserva.pagadoPrimeraMitad = true;
          await reserva.save();
          return true;
        }
        linkDetails.state = pagoValidator
          ? ValidPaymentStatus.total
          : ValidPaymentStatus.mitad;

        reserva.linksHistory.push(linkDetails);
        reserva.status = ValidPaymentStatus.total;
        await reserva.save();
        if (
          reserva.esReactivacion &&
          reserva.status === ValidPaymentStatus.total
        ) {
          await this.handleReactivacionPagoExitoso(reserva);
        }
        return true;

      default:
        return true;
    }
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
    try {
      console.log('=== SERVICIO DISPONIBILIDAD ===');
      console.log('Agencia ID recibido:', agenciaId);
      console.log('DTO recibido:', disponibilidadAutoCoreDto);

      const { layout, checkingDate, ciudad, nights } =
        disponibilidadAutoCoreDto;

      if (
        disponibilidadAutoCoreDto.category === 0 ||
        disponibilidadAutoCoreDto.category === 1
      ) {
        console.log(
          'Usando category del DTO:',
          disponibilidadAutoCoreDto.category,
        );
        const data = await this.httpCustomService.getDisponibilidadAutocore(
          layout,
          checkingDate,
          nights,
          ciudad,
          disponibilidadAutoCoreDto.category,
          false, // Usar URL de producción temporalmente
        );

        return data;
      } else {
        console.log('Obteniendo info de agencia...');
        const agenciaInfo = await this.agenciaModel.findById(agenciaId);

        if (!agenciaInfo) {
          throw new NotFoundException('Agencia no encontrada');
        }

        console.log('Agencia encontrada:', {
          id: agenciaInfo._id,
          fullName: agenciaInfo.fullName,
          category: agenciaInfo.category,
          isActive: agenciaInfo.isActive,
        });

        const data = await this.httpCustomService.getDisponibilidadAutocore(
          layout,
          checkingDate,
          nights,
          ciudad,
          agenciaInfo.category,
          false, // Usar URL de producción temporalmente
        );

        return data;
      }
    } catch (error) {
      console.log('ERROR en getDisponibilidad:', error);
      this.logger.error(error);
      this.errorManager.handle(error);
    }
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
    try {
      const reserva = await this.reservasModel.findById(reservaId);

      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      await this.httpCustomService.cancelarReservas(reserva.reservaChatbotId);
      reserva.status = 4;
      await reserva.save();
      return reserva;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async actualizarStatusReservaManual(
    reservaId: Types.ObjectId | string,
    status: ValidPaymentStatus,
    saltarValidacionCheckin = false,
    forzarCancelacionConPagoMitad = false,
  ) {
    try {
      const _id =
        reservaId instanceof Types.ObjectId
          ? reservaId
          : new Types.ObjectId(String(reservaId));

      const reserva = await this.reservasModel.findById(_id).exec();
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (!saltarValidacionCheckin) {
        const checkinRaw = reserva.reservation?.checkin;
        if (!checkinRaw || typeof checkinRaw !== 'string') {
          throw new BadRequestException(
            'La reserva no tiene check-in válido para validar el cambio de estado',
          );
        }

        const match = checkinRaw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!match) {
          throw new BadRequestException(
            `checkin inválido (se esperaba YYYY-MM-DD): ${checkinRaw}`,
          );
        }
        const checkinDate = new Date(
          `${match[1]}-${match[2]}-${match[3]}T00:00:00`,
        );
        if (Number.isNaN(checkinDate.getTime())) {
          throw new BadRequestException(
            `checkin inválido (no se pudo parsear): ${checkinRaw}`,
          );
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (today >= checkinDate) {
          throw new ForbiddenException(
            'No se puede modificar el estado: la reserva ya llegó a la fecha de check-in. Usa ?saltarValidacionCheckin=true si debes corregir datos como superAdmin.',
          );
        }
      }

      const statusNorm = Number(status);
      if (
        !Number.isInteger(statusNorm) ||
        statusNorm < ValidPaymentStatus.espera ||
        statusNorm > ValidPaymentStatus.reservaAbonada
      ) {
        throw new BadRequestException(
          `status inválido: ${String(status)} (se esperaba entero 0–6)`,
        );
      }

      if (statusNorm === ValidPaymentStatus.cancelado) {
        if (
          !forzarCancelacionConPagoMitad &&
          debeBloquearCancelacionPorPrimeraMitadPagada(reserva)
        ) {
          const destino =
            reserva.reservation?.email?.trim() || 'reservas@gehsuites.com';
          await this.enviarCorreoSaldoPendienteIntentoCancelacion(
            reserva,
            destino,
          );
          throw new BadRequestException(
            'No es posible cancelar esta reserva porque ya registra el pago de la primera mitad con saldo pendiente. Se envió un correo con los pasos para gestionar el pago restante. Use forzarCancelacionConPagoMitad=true si debe cancelar de forma excepcional.',
          );
        }
        await this.httpCustomService.cancelarReservas(reserva.reservaChatbotId);
      }

      const pagadoPrimeraMitad =
        statusNorm === ValidPaymentStatus.mitad ||
        statusNorm === ValidPaymentStatus.reservaAbonada ||
        statusNorm === ValidPaymentStatus.total;

      const updateResult = await this.reservasModel.updateOne(
        { _id },
        { $set: { status: statusNorm, pagadoPrimeraMitad } },
      );

      if (updateResult.matchedCount === 0) {
        throw new NotFoundException(
          'Reserva no encontrada al aplicar el cambio de estado',
        );
      }

      this.logger.log(
        `actualizarStatusReservaManual _id=${String(_id)} status=${statusNorm} pagadoPrimeraMitad=${pagadoPrimeraMitad} matched=${updateResult.matchedCount} modified=${updateResult.modifiedCount}`,
      );

      const actualizada = await this.reservasModel.findById(_id).exec();
      if (!actualizada) {
        throw new NotFoundException('Reserva no encontrada tras actualizar');
      }

      return actualizada;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
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

  /** Mismo estilo que reservaChatbotId de Autocore (ej. CB88D9393D). */
  private generateMyToolLocalizador(): string {
    return `CB${randomBytes(4).toString('hex').toUpperCase()}`;
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
    try {
      return await this.myToolBookingService.getMappings(hotelSlug);
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async createReservaMyTool(
    dto: CreateReservaMyToolDto,
    hotelSlug: string,
    userId: string,
  ) {
    try {
      const hotelConfig = hotelMyToolConfig[hotelSlug];
      if (!hotelConfig) {
        throw new BadRequestException(`Hotel '${hotelSlug}' no configurado`);
      }

      const userInfo = await this.userModel
        .findById(userId)
        .populate('agencia', 'fullName');

      if (!userInfo) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (!userInfo.agencia || typeof userInfo.agencia === 'string') {
        throw new BadRequestException('Información de agencia no disponible');
      }

      const checkin = dto.checkIn;
      const checkout = dto.checkOut;
      const nights = this.calculateNights(checkin, checkout);
      const fallbackUnitaryPrice =
        dto.rooms.length > 0 ? Math.round(dto.total / dto.rooms.length) : 0;
      const getRoomUnitaryPrice = (room: (typeof dto.rooms)[number]) => {
        const dayPrices = (room.dayPrice || [])
          .map((day) => Number(day?.precioBase))
          .filter((price) => Number.isFinite(price) && price >= 0);

        if (dayPrices.length === 0) {
          return fallbackUnitaryPrice;
        }

        const totalByRoom = dayPrices.reduce((sum, price) => sum + price, 0);
        return Math.round(totalByRoom / dayPrices.length);
      };

      const isReservaGrupo = dto.rooms.length >= 10;
      const fechasLimite = calcularFechaLimitePago(
        checkin,
        isReservaGrupo,
        userInfo.agencia._id,
      );
      const { fechaLimitePago, fechaLimitePago2 } = fechasLimite;

      const localizadorGenerado = this.generateMyToolLocalizador();
      let reservaChatbotId: string = localizadorGenerado;
      let reservaProvider: 'mytool' | 'autocore' = 'mytool';
      let usedFallback = false;

      const mascotasNum =
        dto.mascotasNumber ?? dto.bookData.mascotasNumber ?? 0;

      const cleanRooms = dto.rooms.map((room) => {
        const { nombreHabitacion: _nh, room_id: _rid, ...roomRest } = room;
        const cleanGuests = (room.guest || []).map((g) => {
          const cleanGuest: Record<string, any> = {};
          for (const [k, v] of Object.entries(g)) {
            if (v !== null && v !== undefined) {
              cleanGuest[k] = v;
            }
          }
          return cleanGuest;
        });
        return { ...roomRest, guest: cleanGuests };
      });

      // My Tool solo recibe: hotel, fechas, usuario, maquina, bookData, rooms.
      // Excluido a propósito: mascotasNumber en bookData / raíz y demás solo-MongoDB.
      const { mascotasNumber: _mascotasBd, ...bookDataSinMascotas } =
        dto.bookData;
      const myToolBody: Record<string, any> = {
        hotelId: dto.hotelId,
        checkIn: dto.checkIn,
        checkOut: dto.checkOut,
        usuario: dto.usuario || userInfo.fullName || userInfo.email,
        maquinaId: dto.maquinaId ?? 1,
        bookData: {
          ...bookDataSinMascotas,
          localizador: localizadorGenerado,
        },
        rooms: cleanRooms,
      };

      try {
        const myToolResult = await this.myToolBookingService.createBooking(
          hotelSlug,
          myToolBody,
        );

        if (myToolResult.localizador) {
          reservaChatbotId = myToolResult.localizador;
        }

        this.logger.log(
          `Reserva creada via MyTool: ${reservaChatbotId} para hotel ${hotelSlug}`,
        );
      } catch (myToolError) {
        if (!hotelConfig.autocoreId) {
          this.logger.error(
            `MyTool falló para ${hotelSlug} y este hotel no tiene fallback a Autocore: ${myToolError.message}`,
          );
          throw new InternalServerErrorException(
            `No se pudo crear la reserva en MyTool para ${hotelConfig.name}. Este hotel no tiene sistema alternativo de reservas.`,
          );
        }

        const myToolDetail = myToolError?.response?.data
          ? JSON.stringify(myToolError.response.data)
          : myToolError.message;
        this.logger.warn(
          `MyTool falló para ${hotelSlug} (status ${myToolError?.response?.status || 'N/A'}), intentando fallback a Autocore. Detalle: ${myToolDetail}`,
        );

        // Fallback a Autocore
        try {
          const totalAdults = dto.rooms.reduce(
            (sum, r) => sum + r.paxAdultos,
            0,
          );
          const totalChildren = dto.rooms.reduce(
            (sum, r) => sum + r.paxChilds,
            0,
          );

          const reservaInfoForAutocore = {
            agency: {
              is_agency: true,
              agency_type: tiposAgencia.minorista as any,
              external_ref_id:
                (userInfo.agencia as any).cobreInfo?.bolcilloId || '',
            },
            reservation: {
              source_of_bussiness: 'Booking Connect',
              adults: String(totalAdults),
              checkin,
              checkout,
              children: String(totalChildren),
              children_ages: '',
              city: hotelConfig.city.toUpperCase() as any,
              country: 'COL',
              currency: 'COP',
              email: dto.bookData.solicitante.email,
              telephone: dto.bookData.solicitante.telefono,
              firstName: dto.titularInfo.firstName,
              lastName: dto.titularInfo.lastName,
              nights: String(nights),
              notes: dto.notes ?? '',
              rooms: String(dto.rooms.length),
              roomsData: dto.rooms.map((room) => ({
                nombreHabitacion:
                  (room.nombreHabitacion &&
                    String(room.nombreHabitacion).trim()) ||
                  'Habitacion',
                room_id:
                  room.room_id != null && String(room.room_id).trim() !== ''
                    ? String(room.room_id).trim()
                    : '',
                adults: String(room.paxAdultos),
                children: String(room.paxChilds),
                children_ages: '',
                checkin,
                checkout,
                currency: 'COP',
                id: '0',
                quantity: '1',
                rateId: '0',
                unitaryPrice: getRoomUnitaryPrice(room),
              })),
            },
          };

          const autocoreResult =
            await this.httpCustomService.createReservaAutocore(
              hotelConfig.autocoreId,
              reservaInfoForAutocore as any,
            );

          if (!autocoreResult || autocoreResult.no_available_rooms) {
            throw new InternalServerErrorException(
              'Autocore tampoco pudo crear la reserva: ' +
                (autocoreResult?.msg || 'sin respuesta'),
            );
          }

          reservaChatbotId = autocoreResult.chatbot_id;
          reservaProvider = 'autocore';
          usedFallback = true;
          this.logger.log(
            `Reserva creada via Autocore (fallback): ${reservaChatbotId}`,
          );
        } catch (autocoreError) {
          this.logger.error(
            `Fallback a Autocore también falló: ${autocoreError.message}`,
          );
          throw new InternalServerErrorException(
            `No se pudo crear la reserva ni en MyTool ni en Autocore. MyTool (${myToolError?.response?.status || 'N/A'}): ${myToolDetail}. Autocore: ${autocoreError.message}`,
          );
        }
      }

      const retenciones: Record<string, any> = {};
      if (dto.reteFuente) retenciones.reteFuente = dto.reteFuente;
      if (dto.reteIca) retenciones.reteIca = dto.reteIca;
      if (dto.reteIva) retenciones.reteIva = dto.reteIva;

      const reservationData = {
        source_of_bussiness: 'Booking Connect',
        adults: String(dto.rooms.reduce((sum, r) => sum + r.paxAdultos, 0)),
        checkin,
        checkout,
        children: String(dto.rooms.reduce((sum, r) => sum + r.paxChilds, 0)),
        children_ages: '',
        city: hotelConfig.city.toUpperCase(),
        country: 'COL',
        currency: dto.bookData.monedaCode || 'COP',
        email: dto.bookData.solicitante.email,
        telephone: dto.bookData.solicitante.telefono,
        firstName: dto.titularInfo.firstName,
        lastName: dto.titularInfo.lastName,
        nights: String(nights),
        notes: dto.notes ?? '',
        rooms: String(dto.rooms.length),
        roomsData: dto.rooms.map((room) => ({
          nombreHabitacion:
            (room.nombreHabitacion && String(room.nombreHabitacion).trim()) ||
            'Habitacion',
          room_id:
            room.room_id != null && String(room.room_id).trim() !== ''
              ? String(room.room_id).trim()
              : '',
          adults: String(room.paxAdultos),
          children: String(room.paxChilds),
          children_ages: '',
          checkin,
          checkout,
          currency: dto.bookData.monedaCode || 'COP',
          id: '0',
          quantity: '1',
          rateId: '0',
          unitaryPrice: getRoomUnitaryPrice(room),
        })),
      };

      // Guardar en BD con transaccion
      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        const [reserva] = await this.reservasModel.create(
          [
            {
              hotel: hotelConfig.name,
              agenciaId: userInfo.agencia._id,
              userId,
              cantidadHabitaciones: dto.rooms.length,
              total: dto.total,
              totalMitad: dto.total / 2,
              reservation: reservationData,
              reservaChatbotId,
              reservaProvider,
              myToolCanalVentaId: dto.bookData?.canalVentaId ?? null,
              titularInfo: dto.titularInfo,
              fechaLimitePago,
              fechaLimitePago2,
              exentoIva: dto.exentoIva || false,
              ...retenciones,
              planAlimentario: dto.planAlimentario || '',
              adicionCena: dto.adicionCena || false,
              adicionAlmuerzo: dto.adicionAlmuerzo || false,
              infoTransporte: dto.infoTransporte || null,
              infoToures: dto.infoToures || null,
              mascotasNumber: mascotasNum,
              mascotas: mascotasNum > 0,
              origenIata: dto.origenIata,
            },
          ],
          { session },
        );

        userInfo.reservas.push(reserva._id as Types.ObjectId);
        await userInfo.save({ session });

        await session.commitTransaction();

        if (dto.infoTransporte) {
          this.sendTransportNotification(
            dto,
            hotelConfig,
            userInfo,
            checkin,
            checkout,
          ).catch((err) =>
            this.logger.error('Error enviando notificación transporte:', err),
          );
        }

        if (dto.infoToures) {
          this.sendToursNotification(dto, hotelConfig, userInfo, checkin).catch(
            (err) =>
              this.logger.error('Error enviando notificación tours:', err),
          );
        }

        if (dto.rooms.length >= 10) {
          this.sendGroupNotification(
            dto,
            hotelConfig,
            userInfo,
            checkin,
            checkout,
            reservaChatbotId,
          ).catch((err) =>
            this.logger.error('Error enviando notificación grupo:', err),
          );
        }

        return {
          reservaId: reserva._id,
          reservaChatbotId,
          reservaProvider,
          usedFallback,
          hotel: hotelConfig.name,
          checkin,
          checkout,
          nights,
          total: dto.total,
        };
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async cancelarReservaMyTool(dto: CancelReservaMyToolDto, user: User) {
    try {
      const reserva = await this.reservasModel.findOne({
        reservaChatbotId: dto.localizador,
      });
      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      const usuarioCancela =
        (dto.usuarioCancela && dto.usuarioCancela.trim()) ||
        user.fullName ||
        user.email;
      const canalVentaParaMyTool =
        dto.canalVentaId ?? reserva.myToolCanalVentaId ?? undefined;

      if (reserva.status === ValidPaymentStatus.cancelado) {
        return { msg: `Reserva ${reserva.reservaChatbotId} ya está cancelada` };
      }

      if (
        !user.role.includes('admin') &&
        !user.role.includes('super-admin') &&
        reserva.agenciaId.toString() !== user.agencia.toString()
      ) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para cancelar esta reserva',
        );
      }

      if (
        debeBloquearCancelacionPorPrimeraMitadPagada(reserva) &&
        !user.role.includes('super-admin')
      ) {
        await this.enviarCorreoSaldoPendienteIntentoCancelacion(
          reserva,
          user.email,
        );
        throw new BadRequestException(
          'No es posible cancelar esta reserva porque ya registra el pago de la primera mitad con saldo pendiente. Se envió un correo con los pasos para gestionar el pago restante.',
        );
      }

      if (reserva.reservaProvider === 'mytool') {
        const hotelSlug = this.myToolBookingService.findSlugByHotelName(
          reserva.hotel,
        );
        if (!hotelSlug) {
          throw new BadRequestException(
            `No se encontró configuración MyTool para hotel: ${reserva.hotel}`,
          );
        }

        await this.myToolBookingService.cancelBooking(
          hotelSlug,
          reserva.reservaChatbotId,
          usuarioCancela,
          canalVentaParaMyTool,
          dto.maquinaId,
        );
      } else {
        await this.httpCustomService.cancelarReservas(reserva.reservaChatbotId);
      }

      reserva.status = ValidPaymentStatus.cancelado;
      await reserva.save();

      return {
        msg: `Reserva ${reserva.reservaChatbotId} cancelada correctamente`,
        reserva,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
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

  private calculateNights(checkin: string, checkout: string): number {
    const start = new Date(checkin + 'T12:00:00');
    const end = new Date(checkout + 'T12:00:00');
    return Math.round(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  private async sendTransportNotification(
    dto: CreateReservaMyToolDto,
    hotelConfig: { name: string; city: string },
    userInfo: any,
    checkin: string,
    checkout: string,
  ) {
    if (
      !dto.infoTransporte ||
      !userInfo.agencia ||
      typeof userInfo.agencia !== 'object' ||
      !('fullName' in userInfo.agencia) ||
      userInfo.agencia.fullName === 'geh suites'
    ) {
      return;
    }

    const { name, city } = hotelConfig;
    const { tipoRecogida } = dto.infoTransporte;
    const contactInfo =
      city === 'Santa marta'
        ? { email: 'reservasgocolombia@gmail.com', tel: '+57 304 3697601' }
        : city === 'Bogota'
          ? name === 'Hotel Windsor'
            ? {
                email: [
                  'reservas.zonanglobal@gmail.com',
                  'recepcion@hotelwindsorhouse.com',
                ],
                tel: '+57 333 6025021',
              }
            : {
                email: [
                  'reservas.zonanglobal@gmail.com',
                  'recepcionmadisson@gmail.com',
                ],
                tel: '+57 333 6025021',
              }
          : { email: 'operadortour2025@gmail.com', tel: '+57 304 3697601' };

    const textTipoRecogida =
      tipoRecogida === 0
        ? `Servicio de traslado desde el a`
        : tipoRecogida === 1
          ? `Servicio de traslado de ${name} a aeropuerto`
          : `Servicio de traslado de aeropueto a ${name} y salida del ${name} al aeropuerto`;

    await this.emailService.sendEmail(
      contactInfo.email,
      `Solictud de servicio de translado para Geh Suites hotels`,
      notificacionTransporte(
        textTipoRecogida,
        checkin,
        checkout,
        dto.infoTransporte.cantidadPersonas,
        dto.infoTransporte.firstContactNumber,
        dto.infoTransporte.aerolinea,
        dto.infoTransporte.numeroVuelo,
        dto.bookData.solicitante.titular,
        contactInfo.tel,
        dto.infoTransporte.numeroVueloSalida,
        dto.infoTransporte.secondContacNumber,
      ),
    );
  }

  private async sendToursNotification(
    dto: CreateReservaMyToolDto,
    hotelConfig: { name: string; city: string },
    userInfo: any,
    checkin: string,
  ) {
    if (
      !dto.infoToures ||
      !userInfo.agencia ||
      typeof userInfo.agencia !== 'object' ||
      !('fullName' in userInfo.agencia) ||
      userInfo.agencia.fullName === 'geh suites'
    ) {
      return;
    }

    const { name, city } = hotelConfig;
    const email =
      city === 'Santa marta'
        ? 'reservasgocolombia@gmail.com'
        : 'operadortour2025@gmail.com';

    const totalPax = dto.rooms.reduce(
      (sum, r) => sum + r.paxAdultos + r.paxChilds,
      0,
    );

    await this.emailService.sendEmail(
      email,
      `Solictud de servicio de toures para Geh Suites hotels`,
      notificacionToures(
        dto.infoToures.nombres,
        name,
        dto.infoToures.firstContactNumber,
        dto.bookData.solicitante.titular,
        totalPax,
        dto.infoToures.secondContacNumber,
      ),
    );
  }

  private async sendGroupNotification(
    dto: CreateReservaMyToolDto,
    hotelConfig: { name: string },
    userInfo: any,
    checkin: string,
    checkout: string,
    reservaChatbotId: string,
  ) {
    const agenciaName =
      userInfo.agencia &&
      typeof userInfo.agencia === 'object' &&
      'fullName' in userInfo.agencia
        ? (userInfo.agencia.fullName as string)
        : 'Agencia desconocida';

    await this.emailService.sendEmail(
      'reservas@gehsuites.com',
      `Reserva para grupo de ${dto.rooms.length} para agencia ${agenciaName}`,
      notificaiconReservaGrupo(
        agenciaName,
        dto.rooms.length,
        hotelConfig.name,
        checkin,
        checkout,
        reservaChatbotId,
      ),
    );
  }

  // #endregion MyTool Booking

  // #region Reactivación de reservas canceladas
  async reactivarReservaCancelada(
    reactivarReservaDto: ReactivarReservaDto,
    user: User,
  ) {
    try {
      const { reservaChatbotId } = reactivarReservaDto;
      const reservaOrigen = await this.reservasModel.findOne({
        reservaChatbotId,
      });

      if (!reservaOrigen) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (reservaOrigen.status !== ValidPaymentStatus.cancelado) {
        throw new BadRequestException(
          'Solo se pueden reactivar reservas canceladas',
        );
      }

      if (reservaOrigen.reservaProvider !== 'autocore') {
        throw new BadRequestException(
          'Solo se pueden reactivar reservas de proveedor Autocore',
        );
      }

      const esSuperAdmin = user.role.includes('super-admin');
      const agenciaOrigenId = reservaOrigen.agenciaId.toString();
      const agenciaUsuarioId = user.agencia?.toString();

      if (!esSuperAdmin && agenciaOrigenId !== agenciaUsuarioId) {
        throw new ForbiddenException(
          'No cuentas con permisos para reactivar reservas de otra agencia',
        );
      }

      const agenciaInfo = await this.agenciaModel.findById(
        reservaOrigen.agenciaId,
      );
      if (!agenciaInfo) {
        throw new NotFoundException('Agencia no encontrada');
      }

      if (reservaOrigen.reactivacionNuevaReservaId) {
        const reutilizada = await this.reutilizarReactivacionPendiente(
          reservaOrigen,
          agenciaInfo,
        );
        if (reutilizada) {
          return reutilizada;
        }
      }

      const hotelId = obtenerHotelIdPorNombre(reservaOrigen.hotel);
      if (!hotelId) {
        throw new BadRequestException(
          `No se pudo mapear el hotel "${reservaOrigen.hotel}" a un hotelId de Autocore`,
        );
      }

      const reservaInfoAutocore = this.buildReservaInfoAutocoreFromReserva(
        reservaOrigen,
        agenciaInfo,
      );

      const reservaAutocoreInfo =
        await this.httpCustomService.createReservaAutocore(
          hotelId,
          reservaInfoAutocore,
        );

      if (!reservaAutocoreInfo) {
        throw new InternalServerErrorException(
          'Error al crear reserva en Autocore',
        );
      }

      if (reservaAutocoreInfo.no_available_rooms) {
        throw new ConflictException({
          code: 'REACTIVACION_SIN_DISPONIBILIDAD',
          message: 'No hay disponibilidad para reactivar esta reserva',
        });
      }

      const isReservaGrupo = reservaOrigen.cantidadHabitaciones >= 10;
      const fechasLimite = calcularFechaLimitePago(
        reservaOrigen.reservation.checkin,
        isReservaGrupo,
        reservaOrigen.agenciaId,
      );

      const reactivacionExpiraEn = addMinute(new Date(), 24 * 60);
      const session = await this.connection.startSession();
      session.startTransaction();

      let nuevaReserva: Reserva;

      try {
        const [created] = await this.reservasModel.create(
          [
            {
              hotel: reservaOrigen.hotel,
              agenciaId: reservaOrigen.agenciaId,
              userId: reservaOrigen.userId,
              cantidadHabitaciones: reservaOrigen.cantidadHabitaciones,
              total: reservaOrigen.total,
              totalMitad: reservaOrigen.totalMitad,
              reservation: reservaOrigen.reservation,
              reservaChatbotId: reservaAutocoreInfo.chatbot_id,
              titularInfo: reservaOrigen.titularInfo,
              fechaLimitePago: fechasLimite.fechaLimitePago,
              fechaLimitePago2: fechasLimite.fechaLimitePago2,
              exentoIva: reservaOrigen.exentoIva,
              reteFuente: reservaOrigen.reteFuente,
              reteIca: reservaOrigen.reteIca,
              reteIva: reservaOrigen.reteIva,
              planAlimentario: reservaOrigen.planAlimentario,
              adicionCena: reservaOrigen.adicionCena,
              adicionAlmuerzo: reservaOrigen.adicionAlmuerzo,
              infoTransporte: reservaOrigen.infoTransporte,
              infoToures: reservaOrigen.infoToures,
              mascotas: reservaOrigen.mascotas,
              mascotasNumber: reservaOrigen.mascotasNumber,
              origenIata: reservaOrigen.origenIata,
              vuelo: reservaOrigen.vuelo,
              reservaProvider: 'autocore',
              esReactivacion: true,
              reactivacionDeReservaId: reservaOrigen._id,
              reactivacionExpiraEn,
            },
          ],
          { session },
        );

        nuevaReserva = created;

        await this.reservasModel.updateOne(
          { _id: reservaOrigen._id },
          {
            $set: {
              reactivacionNuevaReservaId: nuevaReserva._id,
              reactivacionEstado: 'pendiente_pago',
            },
          },
          { session },
        );

        const ownerUser = await this.userModel
          .findById(reservaOrigen.userId)
          .session(session);
        if (
          ownerUser &&
          !ownerUser.reservas.some((id) =>
            id.equals(nuevaReserva._id as Types.ObjectId),
          )
        ) {
          ownerUser.reservas.push(nuevaReserva._id as Types.ObjectId);
          await ownerUser.save({ session });
        }

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }

      const linkInfo = await this.buildLinkPagoForReserva(
        nuevaReserva,
        agenciaInfo,
        true,
      );

      await nuevaReserva.updateOne({
        $set: {
          linkInfo,
          pagadoPrimeraMitad: true,
          status: ValidPaymentStatus.proceso,
        },
      });

      this.cancellationTasksQueueService.enqueueReactivationExpiryJob(
        nuevaReserva._id.toString(),
        {
          nuevaReservaId: nuevaReserva._id.toString(),
          reservaOrigenId: reservaOrigen._id.toString(),
        },
        reactivacionExpiraEn,
      );

      this.logger.log(
        `Reactivacion iniciada: origen=${reservaOrigen.reservaChatbotId} nueva=${nuevaReserva.reservaChatbotId}`,
      );

      return { linkInfo };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  private async reutilizarReactivacionPendiente(
    reservaOrigen: Reserva,
    agenciaInfo: Agencia,
  ): Promise<{
    linkInfo: { link: string; expirationDate: Date; idLinkPago: string };
  } | null> {
    const nuevaPendiente = await this.reservasModel.findById(
      reservaOrigen.reactivacionNuevaReservaId,
    );

    if (!nuevaPendiente) {
      return null;
    }

    const expirada =
      nuevaPendiente.reactivacionExpiraEn &&
      nuevaPendiente.reactivacionExpiraEn <= new Date();

    const pagadaOCancelada =
      nuevaPendiente.status === ValidPaymentStatus.total ||
      nuevaPendiente.status === ValidPaymentStatus.cancelado;

    if (expirada || pagadaOCancelada) {
      return null;
    }

    const linkInfo = await this.buildLinkPagoForReserva(
      nuevaPendiente,
      agenciaInfo,
      true,
    );

    await nuevaPendiente.updateOne({
      $set: {
        linkInfo,
        pagadoPrimeraMitad: true,
        status: ValidPaymentStatus.proceso,
      },
    });

    this.logger.log(
      `Reactivacion pendiente reutilizada: origen=${reservaOrigen.reservaChatbotId} nueva=${nuevaPendiente.reservaChatbotId}`,
    );

    return { linkInfo };
  }

  private buildReservaInfoAutocoreFromReserva(
    reservaOrigen: Reserva,
    agenciaInfo: Agencia,
  ) {
    const externalRefIdFromAgencia =
      agenciaInfo.cobreInfo?.bolcilloId != null
        ? String(agenciaInfo.cobreInfo.bolcilloId).trim()
        : '';

    const agencyTypeString =
      agenciaInfo.category === 1
        ? tiposAgencia.mayorista
        : tiposAgencia.minorista;

    const reservationData = JSON.parse(
      JSON.stringify(reservaOrigen.reservation),
    );

    return {
      agency: {
        is_agency: true,
        agency_type: agencyTypeString,
        external_ref_id:
          externalRefIdFromAgencia ||
          String(agenciaInfo.autocoreInfo?.id || ''),
      },
      reservation: {
        ...reservationData,
        source_of_bussiness: 'Booking Connect',
      },
    };
  }

  private async handleReactivacionPagoExitoso(reservaNueva: Reserva) {
    if (!reservaNueva.reactivacionDeReservaId) {
      return;
    }

    const reservaOrigen = await this.reservasModel.findById(
      reservaNueva.reactivacionDeReservaId,
    );

    if (reservaOrigen) {
      try {
        await this.httpCustomService.cancelarReservas(
          reservaOrigen.reservaChatbotId,
        );
      } catch (error) {
        this.logger.warn(
          `Cancelacion best-effort de reserva origen ${reservaOrigen.reservaChatbotId}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }

      await this.reservasModel.findByIdAndDelete(reservaOrigen._id);
    }

    await this.reservasModel.updateOne(
      { _id: reservaNueva._id },
      {
        $unset: {
          reactivacionExpiraEn: '',
          reactivacionDeReservaId: '',
        },
        $set: { esReactivacion: false },
      },
    );

    this.logger.log(
      `Reactivacion completada: nueva=${reservaNueva.reservaChatbotId} origen eliminada`,
    );
  }

  private async handleReactivacionPagoFallido(reservaNueva: Reserva) {
    if (reservaNueva.reactivacionCorreoFalloEnviado) {
      return;
    }

    const guestEmail = reservaNueva.reservation?.email?.trim();
    if (!guestEmail) {
      this.logger.warn(
        `Reactivacion pago fallido sin email de huesped: ${reservaNueva.reservaChatbotId}`,
      );
      return;
    }

    const expiraEn =
      reservaNueva.reactivacionExpiraEn ?? addMinute(new Date(), 24 * 60);

    await this.emailService
      .sendEmail(
        guestEmail,
        'Pago de reactivación de reserva no procesado',
        notificacionReactivacionPagoFallido({
          hotel: reservaNueva.hotel,
          checkin: reservaNueva.reservation.checkin,
          checkout: reservaNueva.reservation.checkout,
          reservaChatbotId: reservaNueva.reservaChatbotId,
          monto: reservaNueva.total,
          expiraEn,
        }),
      )
      .catch((error) => {
        this.logger.error(
          `Error enviando correo de reactivacion fallida: ${error}`,
        );
      });

    await this.reservasModel.updateOne(
      { _id: reservaNueva._id },
      { $set: { reactivacionCorreoFalloEnviado: true } },
    );
  }
  // #endregion Reactivación de reservas canceladas
}
