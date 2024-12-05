import { Injectable, Logger } from '@nestjs/common';
import {
  CreateReservaDto,
  DisponibilidadAutocoreDto,
  UpdateReservaDto,
} from './dto';
import { Model, ObjectId } from 'mongoose';
import { ErrorManager } from 'src/common/helpers';
import { InjectModel } from '@nestjs/mongoose';
import { Agencia } from 'src/agencias/entities';
import { HttpCustomService } from 'src/common/services';

@Injectable()
export class ReservasService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(ReservasService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,

    private readonly httpCustomService: HttpCustomService,
  ) {
    this.errorManager = new ErrorManager(ReservasService.name);
  }
  create(createReservaDto: CreateReservaDto) {
    return 'This action adds a new reserva';
  }

  async getDisponibilidad(
    agenciaId: ObjectId,
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
