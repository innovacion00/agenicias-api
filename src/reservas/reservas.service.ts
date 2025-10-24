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
  UpdateReservaDto,
} from './dto';
import { Reserva } from './entities';
import { calcularFechaLimitePago, obtenerCiudadPorNombre } from './utils';
import { LinksHistory, ValidPaymentStatus } from './interfaces';

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

      let planAlimentario = '';

      // Determinar si es reserva de grupo (10 o más habitaciones)
      const isReservaGrupo = createReservaDto.reservaInfo.reservation.roomsData.length >= 10;
      
      // Calcular fechas límite usando la nueva lógica
      const fechasLimite = calcularFechaLimitePago(
        createReservaDto.reservaInfo.reservation.checkin,
        isReservaGrupo,
      );
      
      const { fechaLimitePago, fechaLimitePago2 } = fechasLimite;

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
        hotel: hotelesAutocore[hotelId].name,
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
      });

      userInfo.reservas.push(reserva._id as Types.ObjectId);

      await userInfo.save();

      if (
        createReservaDto.infoTransporte &&
        // @ts-ignore
        userInfo.agencia.fullName !== 'geh suites'
      ) {
        const { name, city } = hotelesAutocore[hotelId];
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
        // @ts-ignore
        userInfo.agencia.fullName !== 'geh suites'
      ) {
        const { name, city } = hotelesAutocore[hotelId];
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
            // @ts-ignore
            `Reserva para grupo de ${cantidadHabitacion} para agencia ${userInfo.agencia.fullName}`,
            notificaiconReservaGrupo(
              // @ts-ignore
              userInfo.agencia.fullName,
              cantidadHabitacion,
              hotelesAutocore[hotelId].name,
              createReservaDto.reservaInfo.reservation.checkin,
              createReservaDto.reservaInfo.reservation.checkout,
              reservaAutocoreInfo.chatbot_id,
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

      if (reserva.linksHistory) {
        for (const linkInfo of reserva.linksHistory) {
          if (
            linkInfo.state === ValidPaymentStatus.mitad ||
            linkInfo.state === ValidPaymentStatus.total
          ) {
            await this.httpCustomService.reembolsoCartera(
              linkInfo.id,
              agenciaDoc.autocoreInfo.id,
              reserva.reservaChatbotId,
            );
          }
        }
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

      if (reserva.infoToures || reserva.infoTransporte) {
        const mensajeCancelacion = notificacionCancelacionToures(
          `${reserva.titularInfo.firstName} ${reserva.titularInfo.lastName}`,
          reserva.reservation.checkin,
          reserva.reservation.checkout,
          reserva.infoToures?.firstContactNumber ||
            reserva.infoTransporte?.firstContactNumber,
        );

        const contactInfo =
          obtenerCiudadPorNombre(reserva.hotel) === 'Santa marta'
            ? 'reservasgocolombia@gmail.com'
            : 'operadortour2025@gmail.com';

        await this.emailService.sendEmail(
          contactInfo,
          `Booking connect - Notificacion de cancelacion de transporte o tour`,
          mensajeCancelacion,
        );
      }

      await this.emailService.sendEmail(
        'reservas@gehsuites.com',
        `Booking connect - Notificacion de cancelacion de reserva por parte de agencia ${agenciaDoc.fullName}`,
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
    if (problemas.includes(valores[0].trim())) {
      return true;
    }
    const autocoreId = payload.transaction_id;
    this.logger.log(payload);
    if (!valores[0].trim()) {
      console.log(
        `${format(new Date(), '[MM/DD/YY - h:mm:ss a]', 'es')} - Error ${JSON.stringify(payload)}`,
      );
      return true;
    }

    const id = valores[0].trim();

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

    if (
      reserva.status === ValidPaymentStatus.total ||
      reserva.status === ValidPaymentStatus.cancelado
    ) {
      return true;
    }

    if (reserva.paymenIds.includes(autocoreId)) {
      return true;
    } else if (autocoreId) {
      reserva.paymenIds.push(autocoreId);
    }

    const status = payload.payment_status as string;
    const linkDetails: LinksHistory = {
      id: payload.details.id,
      typeOfPayment: payload.details.pay_platform
        ? payload.details.pay_platform
        : 'No identificado',
      state: null,
      fecha: new Date(),
    };
    switch (status.toLowerCase()) {
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
          return true;
        }

        reserva.status = ValidPaymentStatus.rejected;
        await reserva.save();
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
        return true;

      default:
        return true;
    }
  }

  // #region Obtener reservas por usuario
  async getReservasByUser(userId: Types.ObjectId) {
    try {
      const reservas = await this.reservasModel
        .find({ userId })
        .sort({ createdAt: -1 });

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
        .sort({ createdAt: -1 })
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
      console.log('=== SERVICIO DISPONIBILIDAD ===');
      console.log('Agencia ID recibido:', agenciaId);
      console.log('DTO recibido:', disponibilidadAutoCoreDto);
      
      const { layout, checkingDate, ciudad, nights } =
        disponibilidadAutoCoreDto;

      if (
        disponibilidadAutoCoreDto.category === 0 ||
        disponibilidadAutoCoreDto.category === 1
      ) {
        console.log('Usando category del DTO:', disponibilidadAutoCoreDto.category);
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
        console.log('Agencia encontrada:', {
          id: agenciaInfo._id,
          fullName: agenciaInfo.fullName,
          category: agenciaInfo.category,
          isActive: agenciaInfo.isActive
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
  //   const reservas = await this.reservasModel.find({
  //     linksHistory: { $exists: true, $not: { $size: 0 } },
  //   });

  //   for (const reserva of reservas) {
  //     const updatedLinks = reserva.linksHistory.map((link) => {
  //       const { status, ...rest } = link; // por si es Mongoose Document
  //       return rest;
  //     });

  //     await this.reservasModel.updateOne(
  //       { _id: reserva._id },
  //       { $set: { linksHistory: updatedLinks } },
  //     );
  //   }
  //   return reservas.length;
  // }
}
