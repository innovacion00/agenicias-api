import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReprocessWebhookDetailsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pay_platform?: string;
}

export class ReprocessWebhookPagoDto {
  @ApiPropertyOptional({ default: 'aplicado' })
  @IsOptional()
  @IsString()
  payment_status?: string;

  @ApiPropertyOptional({
    description: 'Si true, usa external_ref_id con sufijo pagoTotal',
  })
  @IsOptional()
  @IsBoolean()
  pagoTotal?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transaction_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ReprocessWebhookDetailsDto)
  details?: ReprocessWebhookDetailsDto;
}
