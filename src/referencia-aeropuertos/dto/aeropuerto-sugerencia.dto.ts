import { ApiProperty } from '@nestjs/swagger';

export class AeropuertoSugerenciaDto {
  @ApiProperty()
  icao: string;

  @ApiProperty({ nullable: true })
  iata: string | null;

  @ApiProperty()
  name: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  country: string;

  @ApiProperty({ nullable: true })
  lat: number | null;

  @ApiProperty({ nullable: true })
  lon: number | null;

  @ApiProperty()
  tz: string;
}
