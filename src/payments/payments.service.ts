import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { User } from 'src/auth/entities/user.entity';
import { CreateLinkDto } from 'src/common/dto';
import { IgenerateLink } from 'src/common/interface';
import { HttpCustomService } from 'src/common/services';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly httpCustomService: HttpCustomService) {}

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

    this.logger.log(error);
    throw new InternalServerErrorException('Revisar logs');
  }

  async generatePaymentLink(createLinkDto: CreateLinkDto, user: User) {
    const { cobreAuthToken } = await this.httpCustomService.generateCobreJwt();

    const { telefono, email, documentInfo, fullName } = user;
    const { amount, expirationDate, description, references, redirectUrl } =
      createLinkDto;

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
    return {data};
  }
}
