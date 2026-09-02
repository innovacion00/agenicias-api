import { PartialType } from '@nestjs/swagger';
import { CreatePrecioExtraDto } from './create-precio-extra.dto';

export class UpdatePrecioExtraDto extends PartialType(CreatePrecioExtraDto) {}