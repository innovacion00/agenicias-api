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

import { addDay, format, diffDays, addMinute } from '@formkit/tempo';
import { isNotEmptyObject } from 'class-validator';

import { ErrorManager } from 'src/common/helpers';
import { HttpCustomService, SendEmailCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import {
  hotelesAutocore,
  hotelesAutocorePaymenLink,
  notificacionCancelacionVoluntariaReservas,
  notificaiconReservaGrupo,
  tiposAgencia,
} from 'src/config';

import {
  CancelReservaDto,
  CreateReservaDto,
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
  PagoReservaBilleteraDto,
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
    const cantidadHabitacion =
      createReservaDto.reservaInfo.reservation.roomsData.length;
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

      const userInfo = await this.userModel
        .findById(userId)
        .populate('agencia', 'fullName');

      createReservaDto.reservaInfo.reservation.source_of_bussiness =
        'Booking Connect';

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
        adicionCena: createReservaDto.adicionCena || false,
        adicionAlmuerzo: createReservaDto.adicionAlmuerzo || false,
      });

      userInfo.reservas.push(reserva._id as Types.ObjectId);

      await userInfo.save();

      if (cantidadHabitacion >= 10) {
        await this.emailService
          .sendEmail(
            'reservas@gehsuites.com',
            // @ts-ignore
            `Reserva para grupo de ${cantidadHabitacion} para agencia ${userInfo.agencia.fullName}`,
            '',
            notificaiconReservaGrupo(
              // @ts-ignore
              userInfo.agencia.fullName,
              cantidadHabitacion,
              hotelesAutocore[hotelId],
              createReservaDto.reservaInfo.reservation.checkin,
              createReservaDto.reservaInfo.reservation.checkout,
            ),
          )
          .catch((error) => {
            this.logger.error(error);
          });
      }

      return createReservaDto;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region generar link de pago
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

      const external_id = `${generateLinkDto.reservaId}${generateLinkDto.pagoTotal ? ' pagoTotal' : ''}`;

      const linkAutocore = await this.httpCustomService.createLinkPagoAutocore({
        currency: reservaInfo.reservation.currency,
        agency_id: agenciaInfo.autocoreInfo.id,
        amount: generateLinkDto.pagoTotal
          ? reservaInfo.total
          : reservaInfo.totalMitad,
        available_hours: 0.1666,
        booking_dates: `${reservaInfo.reservation.checkin} - ${reservaInfo.reservation.checkout}`,
        description: `Pago para reserva ${reservaInfo.reservaChatbotId} de ${reservaInfo.reservation.nights} noches en ${hotel}`,
        email: agenciaInfo.emailContacto,
        external_ref_id: external_id,
        guest_name: agenciaInfo.fullName,
        hotel_id: hotelesAutocorePaymenLink[hotel],
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

      const linkInfo = {
        link: linkAutocore.url,
        expirationDate: addMinute(new Date(), 5),
        idLinkPago: linkAutocore.code,
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
          notasSuperAdmin: updateReservaDto.notasSuperAdmin
            ? updateReservaDto.notasSuperAdmin
            : reserva.notasSuperAdmin,
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

  // #region Cambiar estado de la reserva autocore
  async cambiarEstadoPagoAutocore(payload: any) {
    const valores = payload.external_ref_id.split(' ') as string[];
    const problemas = [
      '67ab755cedb19b9bad39f22d',
      '67ab7863edb19b9bad3a4471',
      '67cefa09a0c53ce8c5e1fb9b',
      '67bf4b1a7b358f891dce8926',
      '67c084a87b358f891dd07448',
      '67c761d2be7b7404574c2513',
    ];
    const autocoreId = payload.transaction_id;
    console.log(
      ` ${format(new Date(), '[MM/DD/YY - h:mm:ss a]', 'es')} - Valores: ${valores}, Intencion: ${payload.payment_status}, id: ${autocoreId}`,
    );
    if (!valores[0].trim()) {
      console.log(
        `${format(new Date(), '[MM/DD/YY - h:mm:ss a]', 'es')} - Error en valores ${valores}, Intencion: ${payload.payment_status}, id: ${autocoreId}`,
      );
      return true;
    }

    console.log({ payload });

    const id = valores[0].trim();

    if (problemas.includes(id)) {
      return true;
    }

    let pagoValidator = null;

    if (valores[1]) {
      pagoValidator = valores[1].trim();
    }

    const reserva = await this.reservasModel.findById(id);

    if (!reserva.paymenIds) {
      reserva.paymenIds = [];
    }

    if (!reserva) {
      throw new NotFoundException(`Reserva con id: ${id}`);
    }

    if (reserva.status === 3 || reserva.status === 4) {
      return true;
    }

    if (reserva.paymenIds.includes(autocoreId)) {
      return true;
    } else if (autocoreId) {
      reserva.paymenIds.push(autocoreId);
    }

    const status = payload.payment_status as string;
    switch (status.toLowerCase()) {
      case 'en proceso':
        reserva.status = 1;
        await reserva.save();
        return true;

      case 'rechazado':
      case 'cancelado':
        if (pagoValidator) {
          reserva.pagadoPrimeraMitad = false;
          reserva.status = 2;
          await reserva.save();
          return true;
        }

        reserva.status = 2;
        await reserva.save();
        return true;

      case 'aplicado':
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
      const reservas = await this.reservasModel
        .find({ agenciaId })
        .populate('userId', 'fullName')
        .populate('agenciaId', 'fullName _id');
      return reservas;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Disponibilidad
  async getDisponibilidad(
    agenciaId: Types.ObjectId,
    disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    try {
      const { layout, checkingDate, ciudad, nights } =
        disponibilidadAutoCoreDto;

      if (
        disponibilidadAutoCoreDto.category === 0 ||
        disponibilidadAutoCoreDto.category === 1
      ) {
        const data = await this.httpCustomService.getDisponibilidadAutocore(
          layout,
          checkingDate,
          nights,
          ciudad,
          disponibilidadAutoCoreDto.category,
        );

        return data;
      } else {
        const agenciaInfo = await this.agenciaModel.findById(agenciaId);
        const data = await this.httpCustomService.getDisponibilidadAutocore(
          layout,
          checkingDate,
          nights,
          ciudad,
          agenciaInfo.category,
        );

        return data;
      }
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
        .populate('userId', 'fullName')
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
      await reserva.save();
      return reserva;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Pruebas
  // async prueba() {
  //   try {
  //     const reservas = await this.reservasModel.find({
  //       'reservation.source_of_bussiness': { $exists: true },
  //     });

  //     for (const reserva of reservas) {
  //       reserva.reservation.source_of_business =
  //         //@ts-ignore
  //         reserva.reservation.source_of_bussiness;
  //       //@ts-ignore

  //       console.log(reserva.reservation.source_of_bussiness);
  //       //@ts-ignore
  //       delete reserva.reservation.source_of_bussiness;
  //       await reserva.save(); // Guardar los cambios en cada documento
  //     }

  //     return reservas.length;
  //     // const reservas = await this.reservasModel.find({
  //     //   'reservation.source_of_bussiness': { $exists: false },
  //     // });
  //     // return reservas;
  //   } catch (error) {
  //     this.logger.error(error);
  //     this.errorManager.handle(error);
  //   }
  // }
}
