import { Injectable } from '@nestjs/common';
import { CreateReservaDto } from './dto/create-reserva.dto';
import { UpdateReservaDto } from './dto/update-reserva.dto';

@Injectable()
export class ReservasService {
  create(createReservaDto: CreateReservaDto) {
    return 'This action adds a new reserva';
  }
}
