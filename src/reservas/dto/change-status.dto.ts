import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  ValidateNested,
  IsArray,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

class StatusDto {
  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsOptional()
  code: string;

  @IsString()
  @IsOptional()
  description: string;
}

class SourceDto {
  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  counterparty_fullname: string;

  @IsString()
  @IsNotEmpty()
  counterparty_id_type: string;

  @IsString()
  @IsNotEmpty()
  counterparty_id_number: string;
}

class ConnectivityDto {
  @IsString()
  @IsNotEmpty()
  status: string;

  @IsString()
  @IsOptional()
  description: string;
}

class DestinationDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  alias: string;

  @IsString()
  @IsNotEmpty()
  account_type: string;

  @IsString()
  @IsOptional()
  account_number: string;

  @ValidateNested()
  @Type(() => ConnectivityDto)
  connectivity: ConnectivityDto;

  @IsString()
  @IsNotEmpty()
  provider_id: string;

  @IsString()
  @IsNotEmpty()
  provider_name: string;

  @IsNumber()
  @IsNotEmpty()
  obtained_balance: number;

  @IsDateString()
  @IsNotEmpty()
  obtained_balance_at: string;

  @IsNotEmpty()
  metadata: Record<string, string>;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsDateString()
  @IsNotEmpty()
  created_at: string;

  @IsDateString()
  @IsNotEmpty()
  updated_at: string;
}

class MetadataDto {
  @IsString()
  @IsNotEmpty()
  description_to_payer: string;

  @IsString()
  @IsNotEmpty()
  description_to_beneficiary_account: string;

  @IsString()
  @IsOptional()
  redirect_url: string;

  @IsString()
  @IsOptional()
  payment_link: string;

  @IsDateString()
  @IsNotEmpty()
  valid_until: string;

  @IsArray()
  @IsNotEmpty()
  r2p_methods: string[];

  @IsString()
  @IsOptional()
  tracking_key: string;
}

class ContentDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsOptional()
  batch_id: string;

  @IsString()
  @IsOptional()
  external_id: string;

  @IsOptional()
  creator: any;

  @IsString()
  @IsNotEmpty()
  type: string;

  @IsString()
  @IsNotEmpty()
  geo: string;

  @ValidateNested()
  @Type(() => StatusDto)
  status: StatusDto;

  @IsString()
  @IsNotEmpty()
  source_id: string;

  @ValidateNested()
  @Type(() => SourceDto)
  source: SourceDto;

  @IsString()
  @IsNotEmpty()
  destination_id: string;

  @ValidateNested()
  @Type(() => DestinationDto)
  destination: DestinationDto;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ValidateNested()
  @Type(() => MetadataDto)
  metadata: MetadataDto;

  @IsNotEmpty()
  checker_approval: boolean;

  @IsString()
  @IsOptional()
  mm_approval_id: string;

  @IsDateString()
  @IsNotEmpty()
  created_at: string;

  @IsDateString()
  @IsNotEmpty()
  updated_at: string;
}

export class ChangeStatusDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  event_key: string;

  @IsDateString()
  @IsNotEmpty()
  created_at: string;

  @ValidateNested()
  @Type(() => ContentDto)
  content: ContentDto;
}
