import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { agenciaRecargaLimit } from 'src/config';

const { maxLimitValue, minLimitValue } = agenciaRecargaLimit;

export class RechargeWalletDto {
  @IsNumber()
  @IsNotEmpty()
  @Min(minLimitValue, {
    message: `El monto mínimo de recarga es ${minLimitValue}`,
  })
  @Max(maxLimitValue, {
    message: `El monto máximo de recarga es ${maxLimitValue}`,
  })
  amount: number;

  @IsString()
  @IsNotEmpty()
  @IsOptional()
  @IsIn(['COP'])
  currency: string;
}
