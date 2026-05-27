import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { CreateReservaEventoDto } from './dto';
import { ErrorManager } from 'src/common/helpers';
import { Evento } from './entities';
import { User } from 'src/auth/entities';

@Injectable()
export class EventosService {
  private readonly errorManager = new ErrorManager(EventosService.name);
  private readonly logger = new Logger(EventosService.name);
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    @InjectModel(Evento.name) private readonly eventoModel: Model<Evento>,
  ) {}

  async createEventoReserva(
    createReservaEventoDto: CreateReservaEventoDto,
    _id: Types.ObjectId,
  ) {
    try {
      const user = await this.userModel.findById(_id);

      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      const evento = await this.eventoModel.create({
        ...createReservaEventoDto,
        userId: user._id,
        agenciaId: user.agencia,
      });

      user.eventos.push(evento._id as Types.ObjectId);
      await user.save();

      return evento;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async getEventos() {
    try {
      const eventos = await this.eventoModel.find();

      return eventos;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
