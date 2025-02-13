import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { addDay, format, diffDays } from '@formkit/tempo';
import { isNotEmptyObject } from 'class-validator';

import { ErrorManager } from 'src/common/helpers';
import { MetadataLinkPago } from 'src/common/interface';
import { HttpCustomService, SendEmailCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import {
  hotelesAutocore,
  notificacionCancelacionVoluntariaReservas,
  tiposAgencia,
} from 'src/config';

import {
  CancelReservaDto,
  CreateReservaDto,
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
  UpdateReservaDto,
} from './dto';
import { Reserva } from './entities';

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
  ) {
    this.errorManager = new ErrorManager(ReservasService.name);
  }

  // #region Crear reserva
  async createReserva(
    createReservaDto: CreateReservaDto,
    hotelId: string,
    userId: string,
  ) {
    try {
      createReservaDto.reservaInfo.agency.agency_type =
        createReservaDto.reservaInfo.agency.agency_type === 1
          ? tiposAgencia.mayorista
          : tiposAgencia.minorista;

      const fechaActual = new Date();

      let planAlimentario = '';

      const actualDiffDays = diffDays(
        createReservaDto.reservaInfo.reservation.checkin,
        fechaActual,
      );
      let fechaLimitePago: string;
      const fechaLimitePago2: string = format(
        addDay(createReservaDto.reservaInfo.reservation.checkin, -1),
        'YYYY-MM-DD',
      );

      //? Para fechas menores a 72 horas pago inmediato
      if (actualDiffDays <= 3) {
        fechaLimitePago = format(new Date(), 'YYYY-MM-DD');
      }
      //? Para fechas de 4 a 10 dias antes del checkin los pagos deben ser 2 dias antes de la fecha de checkin
      else if (actualDiffDays >= 4 && actualDiffDays <= 10) {
        fechaLimitePago = format(
          addDay(new Date(), actualDiffDays - 2),
          'YYYY-MM-DD',
        );
      }
      //? Para fechas de 11 a 30 dias antes del checkin los pagos deben ser 7 dias antes de la fecha de checkin
      else if (actualDiffDays >= 11 && actualDiffDays <= 30) {
        fechaLimitePago = format(
          addDay(new Date(), actualDiffDays - 7),
          'YYYY-MM-DD',
        );
      }
      //? Para fechas mayores 31 dias el pago debe ser minimo 12 dias antes del checkin
      else {
        fechaLimitePago = format(
          addDay(new Date(), actualDiffDays - 12),
          'YYYY-MM-DD',
        );
      }

      const userInfo = await this.userModel.findById(userId);

      if (!createReservaDto.reservaInfo.reservation.source_of_bussiness) {
        const agenciasInfo = await this.agenciaModel.findById(userInfo.agencia);

        createReservaDto.reservaInfo.reservation.source_of_bussiness =
          agenciasInfo.fullName;
      }

      const reservaAutocoreInfo =
        await this.httpCustomService.createReservaAutocore(
          hotelId,
          createReservaDto.reservaInfo,
        );

      if (reservaAutocoreInfo.no_available_rooms) {
        throw new ConflictException(reservaAutocoreInfo.msg);
      }

      const retenciones: any = {};
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
      const reserva = await this.reservasModel.create({
        hotel: hotelesAutocore[hotelId],
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
      });

      userInfo.reservas.push(reserva._id as Types.ObjectId);

      await userInfo.save();

      return createReservaDto;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
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

      const hotel = reservaInfo.hotel;

      const metadata: MetadataLinkPago = {
        r2p_methods: ['pse', 'nequi', 'bancolombia'],
        description_to_payer: `Pago de reserva en ${hotel}`,
        redirect_url: 'https://agencia.gehsuites.com/misreservas',
        description_to_beneficiary_account: `${reservaInfo.reservaChatbotId}`,
        valid_until: addDay(new Date()),
      };

      const external_id = `${generateLinkDto.reservaId}${generateLinkDto.pagoTotal ? ' pagoTotal' : ''}`;

      const linkPago = await this.httpCustomService.generatePaymenLink(
        agenciaInfo.cobreInfo.counterPartyId,
        agenciaInfo.cobreInfo.bolcilloId,
        generateLinkDto.pagoTotal ? reservaInfo.total : reservaInfo.totalMitad,
        metadata,
        external_id,
      );

      const linkInfo = {
        link: linkPago.metadata.payment_link,
        expirationDate: linkPago.metadata.valid_until,
        idLinkPago: linkPago.id,
      };

      if (generateLinkDto.pagoTotal) {
        await reservaInfo.updateOne({
          $set: { linkInfo, pagadoPrimeraMitad: generateLinkDto.pagoTotal },
        });
      } else {
        await reservaInfo.updateOne({
          $set: { linkInfo },
        });
      }

      return { linkInfo };
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

      if (!user.reservas.includes(reservaId)) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para editar esta reserva',
        );
      }

      const titularInfoUpdates = reserva.titularInfo;
      const reservationUpdates = reserva.reservation;

      const updateReservaDtoFields = Object.keys(updateReservaDto);

      for (const field of updateReservaDtoFields) {
        if (titularInfoUpdates[field]) {
          titularInfoUpdates[field] = updateReservaDto[field];
        }

        if (reservationUpdates[field]) {
          reservationUpdates[field] = updateReservaDto[field];
        }
      }

      const data = await this.httpCustomService.editarReservas(
        reserva.reservaChatbotId,
        updateReservaDto,
      );

      await reserva.updateOne({
        $set: {
          titularInfo: titularInfoUpdates,
          reservation: reservationUpdates,
        },
      });

      return data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
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

      const data = await this.httpCustomService.cancelarReservas(
        reserva.reservaChatbotId,
      );

      const saldoFavor =
        reserva.status !== 3 ? reserva.totalMitad : reserva.total;

      const mensajeReserva = notificacionCancelacionVoluntariaReservas(
        reserva.reservaChatbotId,
        agenciaDoc.fullName,
        reserva.pagadoPrimeraMitad,
        saldoFavor,
      );

      await this.emailService.sendEmail(
        'reservas@gehsuites.com',
        `Booking connect - Notificacion de cancelacion de reserva por parte de agencia ${agenciaDoc.fullName}`,
        '',
        mensajeReserva,
      );

      await reserva.updateOne({
        $set: { status: 4 },
      });

      return data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Cambiar estado de la reserva
  async cambiarEstadoPagoReserva(changeStatusDTO: any) {
    try {
      const valores = changeStatusDTO.content.external_id.split(' ');

      const reserva = await this.reservasModel.findById(valores[0]);

      if (reserva.status === 4 || reserva.status === 3) {
        return true;
      }

      switch (changeStatusDTO.event_key) {
        case 'money_movements.status.initiated':
        case 'money_movements.status.processing':
          reserva.status = 1;
          await reserva.save();
          return true;

        case 'money_movements.status.rejected':
        case 'money_movements.status.canceled':
        case 'money_movements.status.failed':
          if (valores[1]) {
            reserva.pagadoPrimeraMitad = false;
            reserva.status = 2;
            await reserva.save();
            return true;
          }

          reserva.status = 2;
          await reserva.save();
          return true;

        case 'money_movements.status.completed':
          if (!reserva.pagadoPrimeraMitad) {
            reserva.status = 5;
            reserva.pagadoPrimeraMitad = true;
            await reserva.save();
            return true;
          }
          reserva.status = 3;
          await reserva.save();
          return true;
        default:
          return true;
      }
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Obtener reservas por usuario
  async getReservasByUser(userId: Types.ObjectId) {
    try {
      const reservas = await this.reservasModel.find({ userId });
      return reservas;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Obtener reservas por agencia
  async getReservasByAgencia(agenciaId: Types.ObjectId) {
    try {
      const reservas = await this.reservasModel.find({ agenciaId });
      return reservas;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Obtener disponibilidad
  async getDisponibilidad(
    agenciaId: Types.ObjectId,
    disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    try {
      const { layout, checkingDate, ciudad, nights } =
        disponibilidadAutoCoreDto;

      const agenciaInfo = await this.agenciaModel.findById(agenciaId);
      const data = await this.httpCustomService.getDisponibilidadAutocore(
        layout,
        checkingDate,
        nights,
        ciudad,
        agenciaInfo.category,
      );

      return data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Administracion
  //? Obtener todas las reservas
  async getAllReservas() {
    try {
      const allReservas = await this.reservasModel
        .find()
        .populate('agenciaId', 'fullName _id')
        .sort({ createdAt: -1 });

      return allReservas;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Cancelar reservas
  async cancelarReservaAdmin(reservaId: Types.ObjectId) {
    try {
      const reserva = await this.reservasModel.findById(reservaId);
      await this.httpCustomService.cancelarReservas(reserva.reservaChatbotId);
      reserva.status = 4;
      reserva.save();
      return reserva;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // ? Pruebas
  // async prueba() {
  //   try {
  //     const agencia = await this.userModel
  //       .findById('677d7753155954115cea20aa')
  //       .populate('agencia', 'empresa');

  //     const user = agencia.toJSON();

  //     return {
  //       terminado: user,
  //     };
  //   } catch (error) {
  //     this.logger.error(error);
  //     this.errorManager.handle(error);
  //   }
  // }
}
