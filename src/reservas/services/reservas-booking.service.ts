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

import { isNotEmptyObject } from 'class-validator';

import { ErrorManager } from 'src/common/helpers';
import { SendEmailCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import {
  hotelesAutocore,
  notificacionToures,
  notificacionTransporte,
  notificacionReservaGrupo,
  tiposAgencia,
} from 'src/config';
import { hotelMyToolConfig } from 'src/config/constants/myToolBookingConstants';

import { AutocoreClient } from 'src/autocore/autocore.client';
import {
  CreateReservaDto,
  DisponibilidadAutocoreDto,
  UpdateReservaDto,
} from '../dto';
import { CreateReservaMyToolDto } from '../dto/create-reserva-mytool.dto';
import { Reserva } from '../entities';
import { calcularFechaLimitePago } from '../utils';
import { MyToolBookingService } from './my-tool-booking.service';
import { ReservasCountCacheService } from './reservas-count-cache.service';

/**
 * Creación y edición de reservas (Autocore y My Tool), y consulta de
 * disponibilidad/mappings.
 *
 * Extraído de `ReservasService` (PR-2.4): cero cambios de comportamiento.
 * Ver docs/planes/fase2-diseno.md (D3) y fase2-inventario-reservas.md.
 */
@Injectable()
export class ReservasBookingService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(ReservasBookingService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Reserva.name) private readonly reservasModel: Model<Reserva>,
    private readonly emailService: SendEmailCustomService,
    private readonly autocoreClient: AutocoreClient,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly myToolBookingService: MyToolBookingService,
    private readonly countCache: ReservasCountCacheService,
  ) {
    this.errorManager = new ErrorManager(ReservasBookingService.name);
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
        await this.autocoreClient.createReservaAutocore(
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
        this.countCache.invalidateAll();
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
            notificacionReservaGrupo(
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
        const autocoreData = await this.autocoreClient.editarReservas(
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
      this.countCache.invalidateAll();

      return data;
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
        console.log(
          'Usando category del DTO:',
          disponibilidadAutoCoreDto.category,
        );
        const data = await this.autocoreClient.getDisponibilidadAutocore(
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

        const data = await this.autocoreClient.getDisponibilidadAutocore(
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

  /** Mismo estilo que reservaChatbotId de Autocore (ej. CB88D9393D). */
  private generateMyToolLocalizador(): string {
    return `CB${randomBytes(4).toString('hex').toUpperCase()}`;
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
            await this.autocoreClient.createReservaAutocore(
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
        this.countCache.invalidateAll();

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
    _checkin: string,
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
      notificacionReservaGrupo(
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
}
