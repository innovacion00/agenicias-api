import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { agenciaRecargaLimit } from 'src/config';

const { maxLimitValue, minLimitValue } = agenciaRecargaLimit;

export class RechargeWalletDto {
  @ApiProperty({
    description: 'Monto a recargar en la billetera',
    example: 100000,
    type: Number,
    minimum: minLimitValue,
    maximum: maxLimitValue,
  })
  @IsNumber()
  @IsNotEmpty()
  @Min(minLimitValue, {
    message: `El monto mínimo de recarga es ${minLimitValue}`,
  })
  @Max(maxLimitValue, {
    message: `El monto máximo de recarga es ${maxLimitValue}`,
  })
  amount: number;

  @ApiProperty({
    description: 'Moneda (actualmente solo COP)',
    example: 'COP',
    type: String,
    enum: ['COP'],
    required: false,
    default: 'COP',
  })
  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @IsIn(['COP'])
  currency: string;
}
