import { isBefore } from '@formkit/tempo';
import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const IsNotFutureDate = (validationOptions?: ValidationOptions) => {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: string, args: ValidationArguments) {
          const fechaActual = new Date();
          const fechaConsulta = new Date(value);

          return fechaConsulta >= fechaActual;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser una fecha futura o actual.`;
        },
      },
    });
  };
};
