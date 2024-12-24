import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { addDay, format } from '@formkit/tempo';
import {
  ChangeStatusDto,
  CreateReservaDto,
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
} from './dto';
import { ErrorManager } from 'src/common/helpers';
import { MetadataLinkPago } from 'src/common/interface';
import { HttpCustomService } from 'src/common/services';

import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';
import { hotelesAutocore, tiposAgencia } from 'src/config/constants';
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
      });

      userInfo.reservas.push(reserva._id as Reserva);

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
      const agenciaInfo = await this.agenciaModel.findById(agencia);
      const reservaInfo = await this.reservasModel.findById(
        generateLinkDto.reservaId,
      );

      const checkin = format(reservaInfo.reservation.checkin, 'full', 'es');

      const hotel = reservaInfo.hotel;

      const metadata: MetadataLinkPago = {
        r2p_methods: ['pse', 'nequi', 'bancolombia'],
        description_to_payer: `Pago de reserva para el dia ${checkin}, en el ${hotel}`,
        // TODO: Cambiar redirecionamiento
        redirect_url: 'https://www.gehsuites.com/es',
        description_to_beneficiary_account: `Pago de agencia ${agenciaInfo.fullName}, para reserva ${reservaInfo._id}`,
        valid_until: addDay(new Date()),
      };

      const linkInfo = await this.httpCustomService.generatePaymenLink(
        agenciaInfo.cobreInfo.counterPartyId,
        agenciaInfo.cobreInfo.bolcilloId,
        reservaInfo.total,
        metadata,
        generateLinkDto.reservaId,
      );

      const linkPago = {
        link: linkInfo.metadata.payment_link,
        expirationDate: linkInfo.metadata.valid_until,
        idLinkPago: linkInfo.id,
      };

      reservaInfo.updateOne({
        ...reservaInfo,
        linkPago,
      });

      return { linkPago };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
  // #region Cancelar reserva
  async cancelarReserva() {
    return { a: 1 };
  }

  // #region Cambiar estado de la reserva
  async cambiarEstadoPagoReserva(changeStatusDTO: ChangeStatusDto) {
    const reserva = await this.reservasModel.findById(
      changeStatusDTO.content.external_id,
    );

    switch (changeStatusDTO.event_key) {
      case 'money_movements.status.initiated':
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
