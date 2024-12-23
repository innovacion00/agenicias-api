import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ImATeapotException,
  ConflictException,
} from '@nestjs/common';

export class ErrorManager {
  constructor(context: string) {}

  handle(error: any): never {
    if (error.code === 11000) {
      throw new BadRequestException(
        `${JSON.stringify(error.keyValue)} existente en BD`,
      );
    }

    if (
      error instanceof NotFoundException ||
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof ImATeapotException ||
      error instanceof ConflictException
    ) {
      throw error;
    }

    throw new InternalServerErrorException('Revisar logs');
  }
}
