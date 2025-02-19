import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { fileFilter } from './helpers';
import { Auth, GetUser } from 'src/auth/decorators';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('user-profile')
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
