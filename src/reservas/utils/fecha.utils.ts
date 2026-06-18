import { BadRequestException } from '@nestjs/common';

export function parseYyyyMmDdOrThrow(input: string, fieldName: string): Date {
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new BadRequestException(
      `${fieldName} inválido (se esperaba YYYY-MM-DD): ${input}`,
    );
  }
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException(
      `${fieldName} inválido (no se pudo parsear): ${input}`,
    );
  }
  return date;
}
