import {
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  IsString,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO para un elemento extra individual
 */
export class ExtraItemDto {
  @ApiProperty({
    description: 'ID del extra a agregar',
    example: '9977753d0dd96c2a41bb5e2949308208fba42893a6e79807e047ef8a027f92ea',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  extraId: string;

  @ApiProperty({
    description: 'ID del tipo de extra',
    example: '1',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  typeExtraId: string;

  @ApiProperty({
    description: 'ID del pasajero asociado al extra',
    example: '0',
    type: String,
  })
  @IsString()
  @IsNotEmpty()
  passengerId: string;
}

/**
 * DTO para agregar extras a un paquete de vuelo en MaarLab Oceanflights
 */
export class AddExtrasDto {
  @ApiProperty({
    description: 'ID del paquete (opcional si se envía como query parameter)',
    example: 'TEAM-4SZGMN',
    type: String,
    required: false,
  })
  @IsString()
  @IsOptional()
  packageId?: string;

  @ApiProperty({
    description: 'Array de extras a agregar al paquete',
    type: [ExtraItemDto],
    example: [
      {
        extraId:
          '9977753d0dd96c2a41bb5e2949308208fba42893a6e79807e047ef8a027f92ea',
        typeExtraId: '1',
        passengerId: '0',
      },
    ],
  })
  @IsNotEmpty()
  @IsArray()
  @ArrayMinSize(1, { message: 'extras debe contener al menos un elemento' })
  @ValidateNested({ each: true })
  @Type(() => ExtraItemDto)
  extras: ExtraItemDto[];
}
