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
import { HttpCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';

import { hotelesAutocore, tiposAgencia } from 'src/config/constants';

import {
  CancelReservaDto,
  ChangeStatusDto,
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

      const dateDiffDay =
        diffDays(createReservaDto.reservaInfo.reservation.checkin, new Date()) /
        2;
      const dateAddDays = addDay(new Date(), dateDiffDay);
      const fechaLimitePago = format(dateAddDays, 'YYYY-MM-DD');

      const userInfo = await this.userModel.findById(userId);

      const reservaAutocoreInfo =
        await this.httpCustomService.createReservaAutocore(
          hotelId,
          createReservaDto.reservaInfo,
        );

      if (reservaAutocoreInfo.no_available_rooms) {
        throw new ConflictException(reservaAutocoreInfo.msg);
      }

      const reserva = await this.reservasModel.create({
        hotel: hotelesAutocore[hotelId],
        agenciaId: userInfo.agencia._id,
        userId,
        cantidadHabitaciones:
          createReservaDto.reservaInfo.reservation.roomsData.length,
        total: createReservaDto.total,
        reservation: createReservaDto.reservaInfo.reservation,
        reservaChatbotId: reservaAutocoreInfo.chatbot_id,
        titularInfo: createReservaDto.titularInfo,
        fechaLimitePago,
      });

      userInfo.reservas.push(reserva._id as Types.ObjectId);

      await userInfo.save();

      return createReservaDto;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  // #region Generar link de pago
  async generarLinkPago(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    try {
      const agenciaInfo = await this.agenciaModel.findById(agencia).exec();
      const reservaInfo = await this.reservasModel.findById(
        generateLinkDto.reservaId,
      );

      if (!reservaInfo) {
        throw new NotFoundException('Reserva no encontrada');
      }

      const hotel = reservaInfo.hotel;

      const metadata: MetadataLinkPago = {
        r2p_methods: ['pse', 'nequi', 'bancolombia'],
        description_to_payer: `Pago de reserva en ${hotel}`,
        // TODO: Cambiar redirecionamiento
        redirect_url: 'https://www.gehsuites.com/es',
        description_to_beneficiary_account: `${reservaInfo.reservaChatbotId}`,
        valid_until: addDay(new Date()),
      };

      const linkPago = await this.httpCustomService.generatePaymenLink(
        agenciaInfo.cobreInfo.counterPartyId,
        agenciaInfo.cobreInfo.bolcilloId,
        reservaInfo.total,
        metadata,
        generateLinkDto.reservaId,
      );

      const linkInfo = {
        link: linkPago.metadata.payment_link,
        expirationDate: linkPago.metadata.valid_until,
        idLinkPago: linkPago.id,
      };

      await reservaInfo.updateOne({ $set: { linkInfo } });

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

      for (const key of updateReservaDtoFields) {
        if (titularInfoUpdates[key]) {
          titularInfoUpdates[key] = updateReservaDto[key];
        }

        if (reservationUpdates[key]) {
          reservationUpdates[key] = updateReservaDto[key];
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

  // #region Cancelar reserva
  async cancelarReserva(cancelReservaDto: CancelReservaDto, user: User) {
    try {
      const reserva = await this.reservasModel.findById(
        cancelReservaDto.reservaId,
      );

      if (!reserva) {
        throw new NotFoundException('Reserva no encontrada');
      }

      if (reserva.status === 4) {
        return {
          msg: `Reserva ${reserva.reservaChatbotId} ya esta cancelada correctamente`,
        };
      }

      if (!user.reservas.includes(cancelReservaDto.reservaId)) {
        throw new ForbiddenException(
          'No cuentas con los permisos necesarios para cancelar esta reserva',
        );
      }

      const data = await this.httpCustomService.cancelarReservas(
        reserva.reservaChatbotId,
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
  async cambiarEstadoPagoReserva(changeStatusDTO: ChangeStatusDto) {
    const reserva = await this.reservasModel.findById(
      changeStatusDTO.content.external_id,
    );

    if (reserva.status === 4) {
      return true;
    }

    switch (changeStatusDTO.event_key) {
      case 'money_movements.status.initiated':
      case 'money_movements.status.processing':
        reserva.status = 1;
        await reserva.save();
        return true;

      case 'money_movements.status.rejected':
        reserva.status = 2;
        await reserva.save();
        return true;

      case 'money_movements.status.completed':
        reserva.status = 3;
        return true;
      default:
        return true;
    }
  }

  // #region Obtener reservas por usuario
  async getReservasByUser(userId: Types.ObjectId) {
    try {
      const reservas = await this.reservasModel.find({ userId });
      return { reservas };
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
}
