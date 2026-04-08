import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from './helpers';
import { Auth, GetUser } from 'src/auth/decorators';

@ApiTags('files')
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('user-profile')
  @ApiOperation({
    summary: 'Subir imagen de perfil de usuario',
    description: 'Carga una imagen y actualiza la foto de perfil del usuario autenticado.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: fileFilter,
    }),
  )
  @Auth()
  uploadUserImage(
    @UploadedFile() file: Express.Multer.File,
    @GetUser('_id') _id: string,
  ) {
    if (!file) {
      throw new BadRequestException('El archivo debe de ser de tipo imagen');
    }

    return this.filesService.uploadUserImage(file, _id);
  }
}
