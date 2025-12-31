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
          if (!value) return false;
          
          const fechaActual = new Date();
          fechaActual.setHours(0, 0, 0, 0); // Resetear horas a medianoche
          
          const fechaConsulta = new Date(value);
          fechaConsulta.setHours(0, 0, 0, 0); // Resetear horas a medianoche

          return fechaConsulta >= fechaActual;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} debe ser una fecha futura o actual.`;
        },
      },
    });
  };
};
