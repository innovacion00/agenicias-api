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
  
  // Caché para totales de documentos (evita recalcular en cada request)
  private countCache: Map<string, { count: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 1 minuto en milisegundos
  
  // Caché para suma de totales de reservas no canceladas
  private sumaTotalesCache: { value: number; timestamp: number } | null = null;
  private readonly SUMA_CACHE_TTL = 60000; // 1 minuto en milisegundos

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly emailService: SendEmailCustomService,
    private readonly httpCustomService: HttpCustomService,
    @InjectConnection()
    private readonly connection: Connection,
  ) {
    this.errorManager = new ErrorManager(ReservasService.name);
  }

  /**
   * Obtiene el total de documentos con caché
   * @param filter Filtro de búsqueda para generar clave de caché
   * @param useCache Si es false, fuerza recalcular
   */
  private async getCachedCount(filter: any, useCache = true): Promise<number> {
    const cacheKey = JSON.stringify(filter);
    const cached = this.countCache.get(cacheKey);

    if (useCache && cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      this.logger.debug(`Usando total en caché: ${cached.count}`);
      return cached.count;
    }

    // OPTIMIZACIÓN: Para queries sin filtros, usar estimatedDocumentCount (más rápido)
    const isEmptyFilter = !filter || Object.keys(filter).length === 0;
    let count: number;

    if (isEmptyFilter) {
      try {
        count = await this.reservasModel.estimatedDocumentCount();
        this.logger.debug(`Total estimado (sin filtros): ${count}`);
      } catch (error) {
        this.logger.warn('Error al obtener estimatedDocumentCount, usando countDocuments');
        count = await this.reservasModel.countDocuments(filter);
      }
    } else {
      count = await this.reservasModel.countDocuments(filter);
    }

    // Guardar en caché
    this.countCache.set(cacheKey, { count, timestamp: Date.now() });
    
    // Limpiar caché antiguo (más de 5 minutos)
    this.cleanOldCache();

    return count;
  }

  /**
   * Limpia entradas de caché antiguas
   */
  private cleanOldCache(): void {
    const now = Date.now();
    const maxAge = this.CACHE_TTL * 5; // 5 minutos

    for (const [key, value] of this.countCache.entries()) {
      if (now - value.timestamp > maxAge) {
        this.countCache.delete(key);
      }
    }

    // Limpiar caché de suma de totales si es antiguo
    if (this.sumaTotalesCache && now - this.sumaTotalesCache.timestamp > this.SUMA_CACHE_TTL * 5) {
      this.sumaTotalesCache = null;
    }
  }

  /**
   * Obtiene la suma de totales de reservas no canceladas con caché
   */
  private async getSumaTotalesNoCanceladas(useCache = true): Promise<number> {
    // Verificar caché
    if (useCache && this.sumaTotalesCache && 
        Date.now() - this.sumaTotalesCache.timestamp < this.SUMA_CACHE_TTL) {
      this.logger.debug(`Usando suma de totales en caché: ${this.sumaTotalesCache.value}`);
      return this.sumaTotalesCache.value;
    }

    // Calcular la suma usando agregación
    const sumaTotalesNoCanceladas = await this.reservasModel.aggregate([
      {
        $match: {
          status: { $ne: 4 }, // Excluir reservas canceladas (status = 4)
        },
      },
      {
        $group: {
          _id: null,
          totalSum: { $sum: '$total' },
        },
      },
    ]);

    const totalSuma = sumaTotalesNoCanceladas.length > 0 
      ? sumaTotalesNoCanceladas[0].totalSum 
      : 0;

    // Guardar en caché
    this.sumaTotalesCache = {
      value: totalSuma,
      timestamp: Date.now(),
    };

    this.logger.debug(`Suma de totales calculada: ${totalSuma}`);
    return totalSuma;
  }

  /**
   * Calcula la suma de totales de reservas que coinciden con un filtro
   * @param filter Filtro de búsqueda
   */
  private async calcularSumaTotalesPorFiltro(filter: any): Promise<number> {
    try {
      const resultado = await this.reservasModel.aggregate([
        {
          $match: filter,
        },
        {
          $group: {
            _id: null,
            totalSum: { $sum: '$total' },
          },
        },
      ]);

      return resultado.length > 0 ? resultado[0].totalSum : 0;
    } catch (error) {
      this.logger.error('Error al calcular suma de totales:', error);
      return 0;
    }
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

      if (!userInfo) {
        throw new NotFoundException('Usuario no encontrado');
      }

      if (!userInfo.agencia || typeof userInfo.agencia === 'string') {
        throw new BadRequestException('Información de agencia no disponible');
      }

      createReservaDto.reservaInfo.reservation.source_of_bussiness =
        'Booking Connect';

      const reservaAutocoreInfo =
        await this.httpCustomService.createReservaAutocore(
          hotelId,
          createReservaDto.reservaInfo,
        );

      if (!reservaAutocoreInfo) {
        throw new InternalServerErrorException('Error al crear reserva en Autocore');
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

      const hotelInfo = hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
      if (!hotelInfo) {
        throw new BadRequestException(`Hotel con ID ${hotelId} no encontrado`);
      }

      // Usar transacción para asegurar consistencia
      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        const [reserva] = await this.reservasModel.create([{
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
        }], { session });

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
        const hotelInfo = hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
        if (!hotelInfo) {
          throw new BadRequestException(`Hotel con ID ${hotelId} no encontrado`);
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
        const hotelInfo = hotelesAutocore[hotelId as keyof typeof hotelesAutocore];
        if (!hotelInfo) {
          throw new BadRequestException(`Hotel con ID ${hotelId} no encontrado`);
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
              userInfo.agencia && typeof userInfo.agencia === 'object' && 'fullName' in userInfo.agencia
                ? userInfo.agencia.fullName
                : 'Agencia desconocida'
            }`,
            notificaiconReservaGrupo(
              userInfo.agencia && typeof userInfo.agencia === 'object' && 'fullName' in userInfo.agencia
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

      if (!agenciaInfo) {
        throw new NotFoundException('Agencia no encontrada');
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
        hotel_id: hotelesAutocorePaymenLink[hotel as keyof typeof hotelesAutocorePaymenLink] || 0,
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

      const updateReservaDtoFields = Object.keys(updateReservaDto) as Array<keyof UpdateReservaDto>;

      for (const field of updateReservaDtoFields) {
        const value = updateReservaDto[field];
        if (value !== undefined && field in titularInfoUpdates) {
          (titularInfoUpdates as Record<string, any>)[field] = value;
        }

        if (value !== undefined && field in reservationUpdates) {
          (reservationUpdates as Record<string, any>)[field] = value;
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
            reserva.infoTransporte?.firstContactNumber ||
            '',
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

      // Usar transacción para asegurar consistencia
      const session = await this.connection.startSession();
      session.startTransaction();

      try {
        await reserva.updateOne(
          { $set: { status: 4 } },
          { session }
        );

        await session.commitTransaction();
      } catch (error) {
        await session.abortTransaction();
        throw error;
      } finally {
        await session.endSession();
      }

      return data;
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

    const autocoreId = payload.transaction_id;
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

    if (autocoreId && reserva.paymenIds.includes(autocoreId)) {
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
      state: undefined,
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
  async getReservasByUser(userId: Types.ObjectId | string, page = 1) {
    try {
      const PAGE_SIZE = 15;
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      
      // OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
      const MAX_SKIP = 10000; // Máximo 10,000 registros a saltar
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      // Asegurar que userId sea un ObjectId válido para la búsqueda
      // Esto funciona tanto para reservas existentes como nuevas
      let userIdObjectId: Types.ObjectId;
      
      if (userId instanceof Types.ObjectId) {
        userIdObjectId = userId;
      } else if (typeof userId === 'string') {
        // Validar que sea un ObjectId válido antes de crear
        if (!Types.ObjectId.isValid(userId)) {
          throw new BadRequestException('ID de usuario inválido');
        }
        userIdObjectId = new Types.ObjectId(userId);
      } else {
        throw new BadRequestException('Formato de ID de usuario no válido');
      }

      const filter = { userId: userIdObjectId };

      // OPTIMIZACIÓN: Usar caché para el total y optimizar query con índices
      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find(filter)
          .populate('agenciaId', 'fullName _id emailContacto')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 }) // Usa índice compuesto { userId: 1, status: 1, createdAt: -1 }
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(), // Mejor rendimiento al retornar objetos planos
        this.getCachedCount(filter), // Usa caché para el total
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Búsquedas de reservas
  /**
   * Helper para construir filtro base según el rol del usuario
   */
  private construirFiltroPorRol(
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
  ): any {
    const esSuperAdmin = roles.includes('super-admin');
    const esAdmin = roles.includes('admin');

    if (esSuperAdmin) {
      // SuperAdmin: sin filtros, puede ver todas las reservas
      return {};
    } else if (esAdmin) {
      // Admin: solo reservas de su agencia
      return { agenciaId };
    } else {
      // User: solo sus propias reservas
      return { userId };
    }
  }

  //? Buscar reserva por reservaChatbotId
  // Nota: reservaChatbotId es único, por lo tanto la búsqueda es exacta
  // No requiere paginación porque siempre retorna 0 o 1 resultado
  async buscarPorChatbotId(
    reservaChatbotId: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
  ): Promise<{
    data: any | null;
    found: boolean;
    sumaTotales?: number;
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);

      // Búsqueda exacta (reservaChatbotId es único)
      const filtroBusqueda = {
        ...filtroRol,
        reservaChatbotId: reservaChatbotId, // Búsqueda exacta, sin regex
      };

      const [reserva, sumaTotales] = await Promise.all([
        this.reservasModel
          .findOne(filtroBusqueda)
          .populate('agenciaId', 'fullName _id emailContacto')
          .populate('userId', 'fullName email')
          .lean(),
        this.calcularSumaTotalesPorFiltro(filtroBusqueda),
      ]);

      return {
        data: reserva,
        found: !!reserva,
        sumaTotales: reserva ? reserva.total : 0, // Si existe, devolver su total
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por nombre del agente
  async buscarPorNombreAgente(
    nombreAgente: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: { total: number; page?: number; pageSize?: number; totalPages?: number; sumaTotales?: number };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);
      const esSuperAdmin = roles.includes('super-admin');
      const esAdmin = roles.includes('admin');

      // Construir filtro para buscar usuarios según el rol
      let filtroUsuario: any = {
        fullName: { $regex: nombreAgente, $options: 'i' },
      };

      // Si es admin, solo buscar usuarios de su agencia
      if (esAdmin && !esSuperAdmin) {
        filtroUsuario.agencia = agenciaId;
      }
      // Si es user, solo puede buscar su propio nombre
      if (!esAdmin && !esSuperAdmin) {
        filtroUsuario._id = userId;
      }

      // Buscar usuarios que coincidan con el nombre
      const usuarios = await this.userModel
        .find(filtroUsuario)
        .select('_id')
        .lean();

      const userIds = usuarios.map((user) => user._id);

      if (userIds.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
          },
        };
      }

      // Aplicar filtro de rol a las reservas
      const filtroBusqueda = {
        ...filtroRol,
        userId: { $in: userIds },
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales = await this.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar TODAS las reservas sin límite
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
          },
        };
      }

      // Paginación normal
      const PAGE_SIZE = 15;
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      
      // OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
      const MAX_SKIP = 10000; // Máximo 10,000 registros a saltar
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por nombre de agencia
  async buscarPorNombreAgencia(
    nombreAgencia: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: { total: number; page?: number; pageSize?: number; totalPages?: number; sumaTotales?: number };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);
      const esSuperAdmin = roles.includes('super-admin');
      const esAdmin = roles.includes('admin');

      // Construir filtro para buscar agencias según el rol
      let filtroAgencia: any = {
        fullName: { $regex: nombreAgencia, $options: 'i' },
      };

      // Si es admin o user, solo puede buscar su propia agencia
      if (!esSuperAdmin) {
        filtroAgencia._id = agenciaId;
      }

      // Buscar agencias que coincidan con el nombre
      const agencias = await this.agenciaModel
        .find(filtroAgencia)
        .select('_id')
        .lean();

      const agenciaIds = agencias.map((agencia) => agencia._id);

      if (agenciaIds.length === 0) {
        return {
          data: [],
          meta: {
            total: 0,
            ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
          },
        };
      }

      // Aplicar filtro de rol a las reservas
      const filtroBusqueda = {
        ...filtroRol,
        agenciaId: { $in: agenciaIds },
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales = await this.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar TODAS las reservas sin límite
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
          },
        };
      }

      // Paginación normal
      const PAGE_SIZE = 15;
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      
      // OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
      const MAX_SKIP = 10000; // Máximo 10,000 registros a saltar
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por nombre del huésped
  async buscarPorNombreHuesped(
    nombreHuesped: string,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: { total: number; page?: number; pageSize?: number; totalPages?: number; sumaTotales?: number };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);

      // Normalizar el texto de búsqueda: eliminar espacios extra
      const nombreLimpio = nombreHuesped.trim().replace(/\s+/g, ' ');
      
      // Escapar caracteres especiales para regex de forma segura
      const nombreEscapado = nombreLimpio.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      // Dividir el nombre en partes (por si es nombre completo como "Juan Pérez")
      const partesNombre = nombreLimpio.split(/\s+/).filter(p => p.length > 0);

      // Construir condiciones de búsqueda
      const condicionesBusqueda: any[] = [
        // Búsqueda en firstName (case-insensitive)
        { 'reservation.firstName': { $regex: nombreEscapado, $options: 'i' } },
        // Búsqueda en lastName (case-insensitive)
        { 'reservation.lastName': { $regex: nombreEscapado, $options: 'i' } },
      ];

      // Si hay múltiples palabras, buscar también en la combinación
      if (partesNombre.length > 1) {
        // Buscar si alguna parte coincide con firstName y otra con lastName
        // Ejemplo: "Juan Pérez" busca firstName="Juan" AND lastName contiene "Pérez"
        // o firstName contiene "Pérez" AND lastName="Juan"
        partesNombre.forEach((parte, index) => {
          const parteEscapada = parte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const otrasPartes = partesNombre
            .filter((_, i) => i !== index)
            .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('|');
          
          condicionesBusqueda.push({
            $and: [
              { 'reservation.firstName': { $regex: parteEscapada, $options: 'i' } },
              { 'reservation.lastName': { $regex: otrasPartes, $options: 'i' } },
            ],
          });
        });

        // Buscar en la concatenación completa usando $expr (firstName + " " + lastName)
        const nombreCompletoRegex = partesNombre
          .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('.*');
        condicionesBusqueda.push({
          $expr: {
            $regexMatch: {
              input: {
                $concat: [
                  { $ifNull: ['$reservation.firstName', ''] },
                  ' ',
                  { $ifNull: ['$reservation.lastName', ''] },
                ],
              },
              regex: nombreCompletoRegex,
              options: 'i',
            },
          },
        });
      }

      // Buscar por firstName, lastName o combinación en reservation
      const filtroBusqueda = {
        ...filtroRol,
        $or: condicionesBusqueda,
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales = await this.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar TODAS las reservas sin límite
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
          },
        };
      }

      // Paginación normal
      const PAGE_SIZE = 15;
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      
      // OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
      const MAX_SKIP = 10000; // Máximo 10,000 registros a saltar
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  //? Buscar reservas por estado
  async buscarPorEstado(
    status: ValidPaymentStatus,
    userId: Types.ObjectId,
    agenciaId: Types.ObjectId,
    roles: string[],
    page = 1,
    all = false,
  ): Promise<{
    data: any[];
    meta: { total: number; page?: number; pageSize?: number; totalPages?: number; sumaTotales?: number };
  }> {
    try {
      const filtroRol = this.construirFiltroPorRol(userId, agenciaId, roles);

      const filtroBusqueda = {
        ...filtroRol,
        status,
      };

      // Calcular suma de totales para las reservas que coinciden con el filtro
      const sumaTotales = await this.calcularSumaTotalesPorFiltro(filtroBusqueda);

      // Si all=true, retornar TODAS las reservas sin límite
      // ADVERTENCIA: Esto puede ser lento si hay muchas reservas (miles o millones)
      if (all) {
        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            // Sin límite - retorna todas las reservas que cumplan el filtro
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

        return {
          data: reservas,
          meta: {
            total,
            sumaTotales,
          },
        };
      }

      // Paginación normal
      const PAGE_SIZE = 15;
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      
      // OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
      const MAX_SKIP = 10000; // Máximo 10,000 registros a saltar
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

        const [reservas, total] = await Promise.all([
          this.reservasModel
            .find(filtroBusqueda)
            .populate('agenciaId', 'fullName _id emailContacto')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(PAGE_SIZE)
            .lean(),
          this.getCachedCount(filtroBusqueda),
        ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotales,
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Obtener reservas por agencia
  async getReservasByAgencia(agenciaId: Types.ObjectId, page = 1) {
    try {
      const PAGE_SIZE = 15;
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      
      // OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
      const MAX_SKIP = 10000; // Máximo 10,000 registros a saltar
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      // OPTIMIZACIÓN: Agregar select y lean() para mejor rendimiento
      const [reservas, total] = await Promise.all([
        this.reservasModel
          .find({ agenciaId })
          .populate('userId', 'fullName email')
          .populate('agenciaId', 'fullName _id')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(), // Mejor rendimiento al retornar objetos planos
        this.getCachedCount({ agenciaId }),
      ]);

      return {
        data: reservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
        },
      };
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
        
        if (!agenciaInfo) {
          throw new NotFoundException('Agencia no encontrada');
        }

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
  async getAllReservas(
    page = 1, 
    all = false, 
    hotel?: string, 
    nombreAgencia?: string,
    fechaDesde?: string,
    fechaHasta?: string
  ) {
    try {
      // Construir el filtro
      const filter: any = {};
      
      // Si se proporciona el parámetro hotel, agregarlo al filtro
      if (hotel && hotel.trim()) {
        // Búsqueda case-insensitive y parcial del nombre del hotel
        filter.hotel = { $regex: hotel.trim(), $options: 'i' };
      }

      // Filtro por nombre de agencia (solo para superAdmin)
      if (nombreAgencia && nombreAgencia.trim()) {
        // Buscar agencias que coincidan con el nombre
        const filtroAgencia: any = {
          fullName: { $regex: nombreAgencia.trim(), $options: 'i' },
        };
        
        const agencias = await this.agenciaModel
          .find(filtroAgencia)
          .select('_id')
          .lean();
        
        const agenciaIds = agencias.map((agencia) => agencia._id);
        
        if (agenciaIds.length === 0) {
          // Si no se encuentran agencias, retornar vacío
          return {
            data: [],
            meta: {
              total: 0,
              ...(all ? {} : { page: 1, pageSize: 15, totalPages: 0 }),
              sumaTotalesNoCanceladas: 0,
              ...(hotel && { hotelFiltrado: hotel }),
              ...(nombreAgencia && { nombreAgenciaFiltrado: nombreAgencia }),
            },
          };
        }
        
        filter.agenciaId = { $in: agenciaIds };
      }

      // Filtro por fecha de checkin (fechaDesde y/o fechaHasta)
      if (fechaDesde || fechaHasta) {
        // El checkin está almacenado como string en formato YYYY-MM-DD
        // Usamos comparación de strings ya que el formato es ISO (YYYY-MM-DD)
        if (fechaDesde && fechaHasta) {
          // Rango completo: desde fechaDesde hasta fechaHasta
          filter['reservation.checkin'] = {
            $gte: fechaDesde.trim(),
            $lte: fechaHasta.trim(),
          };
        } else if (fechaDesde) {
          // Solo fechaDesde: filtrar solo ese día específico
          filter['reservation.checkin'] = fechaDesde.trim();
        } else if (fechaHasta) {
          // Solo fechaHasta: checkin <= fechaHasta
          filter['reservation.checkin'] = {
            $lte: fechaHasta.trim(),
          };
        }
      }

      // Obtener la suma de totales de reservas no canceladas (con caché)
      const totalSuma = await this.getSumaTotalesNoCanceladas();

      // Si all=true, retornar TODAS las reservas sin límite
      if (all) {
        const [allReservas, total] = await Promise.all([
          this.reservasModel
            .find(filter)
            .populate('agenciaId', 'fullName _id')
            .populate('userId', 'fullName email')
            .sort({ createdAt: -1 })
            .lean(),
          this.getCachedCount(filter),
        ]);

        return {
          data: allReservas,
          meta: {
            total,
            sumaTotalesNoCanceladas: totalSuma,
            ...(hotel && { hotelFiltrado: hotel }),
            ...(nombreAgencia && { nombreAgenciaFiltrado: nombreAgencia }),
            ...(fechaDesde && { fechaDesde }),
            ...(fechaHasta && { fechaHasta }),
          },
        };
      }

      // Paginación normal
      const PAGE_SIZE = 15;
      const currentPage = Number(page) > 0 ? Number(page) : 1;
      
      // OPTIMIZACIÓN: Limitar skip máximo para evitar queries muy lentas
      const MAX_SKIP = 10000; // Máximo 10,000 registros a saltar
      const skip = Math.min((currentPage - 1) * PAGE_SIZE, MAX_SKIP);

      // OPTIMIZACIÓN: Usar caché para el total y optimizar query
      const [allReservas, total] = await Promise.all([
        this.reservasModel
          .find(filter)
          .populate('agenciaId', 'fullName _id')
          .populate('userId', 'fullName email')
          .sort({ createdAt: -1 }) // Usa índice { status: 1, createdAt: -1 }
          .skip(skip)
          .limit(PAGE_SIZE)
          .lean(), // Mejor rendimiento al retornar objetos planos
        this.getCachedCount(filter), // Usa caché para el total (estimatedDocumentCount si no hay filtros)
      ]);

      return {
        data: allReservas,
        meta: {
          total,
          page: currentPage,
          pageSize: PAGE_SIZE,
          totalPages: Math.ceil(total / PAGE_SIZE) || 1,
          sumaTotalesNoCanceladas: totalSuma,
          ...(hotel && { hotelFiltrado: hotel }),
          ...(nombreAgencia && { nombreAgenciaFiltrado: nombreAgencia }),
          ...(fechaDesde && { fechaDesde }),
          ...(fechaHasta && { fechaHasta }),
        },
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
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
