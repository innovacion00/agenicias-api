import { IsString, IsOptional, IsNumber, Min, Max, IsArray } from 'class-validator';
import { Transform } from 'class-transformer';

export class SearchCitiesDto {
  @IsString()
  @Transform(({ value }) => value?.toUpperCase())
  countryCode?: string;

  @IsString()
  keyword: string;

  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Transform(({ value }) => parseInt(value))
  max?: number = 10;

  @IsArray()
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map(item => item.trim().toUpperCase());
    }
    return value;
  })
  include?: string[] = ['AIRPORTS'];
}
