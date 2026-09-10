import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ValidIntegrationsRoles } from 'src/auth/interfaces';

export class CreateIntegrationDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(ValidIntegrationsRoles, { each: true })
  roles?: ValidIntegrationsRoles[];
}
