import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from 'src/auth/entities';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { ErrorManager } from 'src/common/helpers';

@Injectable()
export class FilesService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(FilesService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>,
    private readonly cloudinaryService: CloudinaryService,
  ) {
    this.errorManager = new ErrorManager(FilesService.name);
  }

  async uploadUserImage(file: Express.Multer.File, _id: string) {
    try {
      const user = await this.userModel
        .findById(_id)
        .populate('agencia', 'fullName');

      if (!user) {
        throw new BadRequestException('Usuario no encontrado');
      }

      const agenciaName =
        user.agencia &&
        typeof user.agencia === 'object' &&
        'fullName' in user.agencia
          ? (user.agencia.fullName as string)
          : 'default';

      if (user.imageUrl) {
        await this.cloudinaryService.deleteCloudinary(
          user.imageUrl,
          `agencias/${agenciaName}`,
        );
      }
      const fileInfo = await this.cloudinaryService.uploadImage(
        file,
        `agencias/${agenciaName}`,
      );
      if (!fileInfo.secure_url) {
        throw new BadRequestException('No fue posible subir la imagen');
      }

      user.imageUrl = fileInfo.secure_url;
      await user.save();
      return {
        url: fileInfo.secure_url,
      };
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
