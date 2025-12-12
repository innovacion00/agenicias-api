import { Injectable } from '@nestjs/common';
import {
  UploadApiErrorResponse,
  UploadApiResponse,
  v2 as cloudinary,
} from 'cloudinary';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const toStream = require('buffer-to-stream');

@Injectable()
export class CloudinaryService {
  async uploadImage(
    file: Express.Multer.File,
    folder: string,
  ): Promise<UploadApiResponse | UploadApiErrorResponse> {
    return new Promise((resolve, reject) => {
      const upload = cloudinary.uploader.upload_stream(
        { folder },
        (error: Error | undefined, result: UploadApiResponse | undefined) => {
          if (error) return reject(error);
          if (!result) {
            return reject(new Error('No se recibió respuesta de Cloudinary'));
          }
          resolve(result);
        },
      );

      toStream(file.buffer).pipe(upload);
    });
  }

  async deleteCloudinary(url: string, path: string) {
    const [fileId, type] = url.substring(url.lastIndexOf('/') + 1).split('.');

    await cloudinary.uploader.destroy(path.concat(`/${fileId}`));
    return;
  }
}
