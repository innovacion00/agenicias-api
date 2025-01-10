import {
  ArgumentMetadata,
  BadRequestException,
  Injectable,
  PipeTransform,
} from '@nestjs/common';

import { isAfter } from '@formkit/tempo';

import { CreateReservaDto } from '../dto';

@Injectable()
export class ValidateCheckinCheckout implements PipeTransform {
  transform(createReservaDto: CreateReservaDto, metadata: ArgumentMetadata) {
    const {
      checkin: primaryCheckin,
      checkout: primaryCheckout,
      roomsData,
    } = createReservaDto.reservaInfo.reservation;

    if (isAfter(primaryCheckin, primaryCheckout)) {
      throw new BadRequestException(
        'La fecha de checkin en reservaInfo.reservation debe ser mayor a la fecha de checkout',
      );
    }

    for (let i = 0; i < roomsData.length; i++) {
      const { checkin, checkout } = roomsData[i];

      if (isAfter(checkin, checkout)) {
        throw new BadRequestException(
          `La fecha de checkin en reservaInfo.reservation.roomsData[${i}] debe ser mayor a la fecha de checkout`,
        );
      }
    }

    return createReservaDto;
  }
}