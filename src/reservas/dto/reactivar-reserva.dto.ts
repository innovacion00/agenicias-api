import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ReactivarReservaDto {
  @ApiProperty({
    description: 'ID chatbot de la reserva cancelada a reactivar',
    example: 'CB88D9393D',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  reservaChatbotId: string;
}
