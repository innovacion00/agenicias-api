import { IsBoolean, IsMongoId, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Types } from 'mongoose';

export class GenerateLinkDto {
  @ApiProperty({
    description: 'ID de la reserva (MongoId)',
    example: '507f1f77bcf86cd799439011',
    type: String,
  })
  @IsMongoId()
  @IsNotEmpty()
  reservaId: Types.ObjectId;

  @ApiProperty({
    description: 'Indica si se pagará el total o solo la mitad',
    example: false,
    type: Boolean,
    required: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  pagoTotal: boolean;
}
