import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

import { isAfter } from '@formkit/tempo';

import { CreateReservaDto } from '../dto';
import { validarCheckinNoEsMismoDia } from '../utils/checkin-reserva.utils';

@Injectable()
export class ParseCheckinCheckoutPipe implements PipeTransform {
  transform(createReservaDto: CreateReservaDto, _metadata: ArgumentMetadata) {
    const {
      checkin: primaryCheckin,
      checkout: primaryCheckout,
      roomsData,
    } = createReservaDto.reservaInfo.reservation;

    validarCheckinNoEsMismoDia(primaryCheckin);

    if (isAfter(primaryCheckin, primaryCheckout)) {
      throw new BadRequestException(
        'La fecha de checkin en reservaInfo.reservation debe ser mayor a la fecha de checkout',
      );
    }

    for (let i = 0; i < roomsData.length; i++) {
      const roomData = roomsData[i];
      if (!roomData) {
        throw new BadRequestException(
          `Datos de habitación en índice ${i} no válidos`,
        );
      }
      const { checkin, checkout } = roomData;

      validarCheckinNoEsMismoDia(checkin);

      if (isAfter(checkin, checkout)) {
        throw new BadRequestException(
          `La fecha de checkin en reservaInfo.reservation.roomsData[${i}] debe ser mayor a la fecha de checkout`,
        );
      }
    }

    return createReservaDto;
  }
}
