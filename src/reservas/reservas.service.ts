import { Injectable, Logger } from '@nestjs/common';
import {
  CreateReservaDto,
  DisponibilidadAutocoreDto,
  GenerateLinkDto,
  UpdateReservaDto,
} from './dto';
import { Model, Types } from 'mongoose';
import { ErrorManager } from 'src/common/helpers';
import { InjectModel } from '@nestjs/mongoose';
import { Agencia } from 'src/agencias/entities';
import { User } from 'src/auth/entities';
import { HttpCustomService } from 'src/common/services';
import { hotelesAutocore, tiposAgencia } from 'src/config/constants';
import { Reserva } from './entities';
import { MetadataLinkPago } from 'src/common/interface';
import { addDay, format } from '@formkit/tempo';

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

  async createReserva(
    createReservaDto: CreateReservaDto,
    hotelId: string,
    userId: Types.ObjectId,
  ) {
    createReservaDto.reservaInfo.agency.agency_type =
      createReservaDto.reservaInfo.agency.agency_type === 1
        ? tiposAgencia.mayorista
        : tiposAgencia.minorista;
    const agenciaInfo = await this.userModel.findById(userId).select('agencia');

    const reservaAutocoreInfo =
      await this.httpCustomService.createReservaAutocore(
        hotelId,
        createReservaDto.reservaInfo,
      );
    const reserva = this.reservasModel.create({
      hotel: hotelesAutocore[hotelId],
      agenciaId: agenciaInfo.agencia._id,
      userId,
      cantidadHabitaciones:
        createReservaDto.reservaInfo.reservation.roomsData.length,
      total: createReservaDto.total,
      reservation: createReservaDto.reservaInfo.reservation,
      reservaChatbotId: reservaAutocoreInfo.chatbot_id,
    });

    return reserva;
  }

  async generarLinkPago(
    generateLinkDto: GenerateLinkDto,
    agencia: Types.ObjectId,
  ) {
    const agenciaInfo = await this.agenciaModel.findById(agencia);
    const reservaInfo = await this.reservasModel.findById(
      generateLinkDto.reservaId,
    );

    const checkin = format(reservaInfo.reservation.checkin, 'full', 'es');

    const hotel = reservaInfo.hotel;

    const metadata: MetadataLinkPago = {
      r2p_methods: ['pse', 'nequi', 'bancolombia'],
      description_to_payer: `Pago de reserva para el dia ${checkin}, en el ${hotel}`,
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
    return { agencia };
  }

  async getReservasByUser(userId: string) {
    const reservas = await this.reservasModel.find({ userId });
    return { reservas };
  }

  async getDisponibilidad(
    agenciaId: Types.ObjectId,
    disponibilidadAutoCoreDto: DisponibilidadAutocoreDto,
  ) {
    const { layout, checkingDate, ciudad, nights } = disponibilidadAutoCoreDto;

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
}
