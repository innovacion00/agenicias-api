import { Injectable, Logger } from '@nestjs/common';
import {
  CreateReservaDto,
  DisponibilidadAutocoreDto,
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

  async create(createReservaDto: CreateReservaDto, hotelId: string) {
    createReservaDto.reservaInfo.agency.agency_type =
      createReservaDto.reservaInfo.agency.agency_type === 1
        ? tiposAgencia.mayorista
        : tiposAgencia.minorista;
    const agenciaInfo = await this.userModel
      .findById(createReservaDto.userId)
      .select('agencia');

    const reservaAutocoreInfo =
      await this.httpCustomService.createReservaAutocore(
        hotelId,
        createReservaDto.reservaInfo,
      );
    const reserva = this.reservasModel.create({
      hotel: hotelesAutocore[hotelId],
      agenciaId: agenciaInfo.id,
      userId: createReservaDto.userId,
      cantidadHabitaciones:
        createReservaDto.reservaInfo.reservation.roomsData.length,
      total: createReservaDto.total,
      reservation: createReservaDto.reservaInfo.reservation,
      reservaChatbotId: reservaAutocoreInfo.chatbot_id,
    });

    return reserva;
  }

  async getReservasByUser(userId: string) {
    return { userId };
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
