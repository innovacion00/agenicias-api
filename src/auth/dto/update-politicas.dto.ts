import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePoliticasDto {
  @ApiProperty({
    description: 'Políticas de cancelación y condiciones de la agencia',
    example:
      'Políticas de cancelación: 24 horas antes de la fecha de check-in. Penalización del 50% por cancelación tardía.',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  politicasAgencia: string;
}
