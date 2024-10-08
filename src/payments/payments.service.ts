import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Agencia } from 'src/agencias/entities';

import { User } from 'src/auth/entities/user.entity';

import { CreateLinkDto } from 'src/common/dto';
import { IgenerateLink } from 'src/common/interface';
import { HttpCustomService } from 'src/common/services';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,

    private readonly httpCustomService: HttpCustomService,
  ) {}

  private handleError(error: any): never {
    if (error instanceof NotFoundException) {
      throw error;
    }

    if (error instanceof BadRequestException) {
      throw error;
    }

    if (error instanceof UnauthorizedException) {
      throw error;
    }

    this.logger.error(error);
    throw new InternalServerErrorException('Revisar logs');
  }

  async generatePaymentLink(createLinkDto: CreateLinkDto, user: User) {
    // TODO: Probar
    try {
      const agenciaInfo = await this.agenciaModel
        .findById(user.agencia)
        .select('documentInfo isActive');

      if (!agenciaInfo) {
        throw new NotFoundException('Agencia no encontrada');
      }

      if (!agenciaInfo.isActive) {
        throw new ForbiddenException('Agencia innavilitada');
      }

      const documentInfo = {
        document: agenciaInfo.documentInfo.document,
        tipo: agenciaInfo.documentInfo.tipo,
      };
      const { telefono, email, fullName } = user;
      const {
        amount,
        reservaId,
        expirationDate,
        description,
        references,
        redirectUrl,
      } = createLinkDto;

      const { cobreAuthToken } =
        await this.httpCustomService.generateCobreJwt();

      const properties: IgenerateLink = {
        cellPhone: telefono,
        email,
        amount,
        description,
        document: documentInfo.document,
        documentType: documentInfo.tipo,
        expirationDate,
        fullName,
        jwt: cobreAuthToken,
        redirectUrl,
        references,
      };

      const data = await this.httpCustomService.generateCobreLink(properties);
      return data;
    } catch (error) {
      this.handleError(error);
    }
  }
}
