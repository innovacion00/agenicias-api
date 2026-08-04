import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import {
  esCheckinMismoDiaQueHoy,
  MENSAJE_CHECKIN_MISMO_DIA,
} from '../utils/checkin-reserva.utils';

export const IsNotSameDayCheckin = (validationOptions?: ValidationOptions) => {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotSameDayCheckin',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          if (!value) return false;
          return !esCheckinMismoDiaQueHoy(value);
        },
        defaultMessage(_args: ValidationArguments) {
          return MENSAJE_CHECKIN_MISMO_DIA;
        },
      },
    });
  };
};
