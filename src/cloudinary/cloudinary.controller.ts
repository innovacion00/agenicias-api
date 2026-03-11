import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CloudinaryService } from './cloudinary.service';

@ApiTags('cloudinary')
@Controller('cloudinary')
export class CloudinaryController {
  constructor(private readonly cloudinaryService: CloudinaryService) {}
}
