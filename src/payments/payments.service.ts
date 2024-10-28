import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';

import { Model, Types } from 'mongoose';

import { Agencia } from 'src/agencias/entities';
import { CreateLinkDto } from 'src/common/dto';
import { ErrorManager } from 'src/common/helpers';
import { HttpCustomService } from 'src/common/services';
import { IgenerateLink } from 'src/common/interface';
// import { User } from 'src/auth/entities/user.entity';

@Injectable()
export class PaymentsService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectModel(Agencia.name) private readonly agenciaModel: Model<Agencia>,

    private readonly httpCustomService: HttpCustomService,
  ) {
    this.errorManager = new ErrorManager(PaymentsService.name);
  }
  // TODO: Modificar para reservas
  async generatePaymentLink(
    createLinkDto: CreateLinkDto,
    agencia: Types.ObjectId,
  ) {
    try {
      const agenciaInfo = await this.agenciaModel.findById(agencia);
      const documentInfo = {
        document: agenciaInfo.documentInfo.document,
        tipo: agenciaInfo.documentInfo.tipo,
      };
      const { emailContacto, fullName, telefonoContacto } = agenciaInfo;
      const {
        amount,
        // reservaId,
        expirationDate,
        description,
        references,
        redirectUrl,
      } = createLinkDto;

      const { cobreAuthToken } =
        await this.httpCustomService.generateCobreJwt();

      // return {cobreAuthToken};

      const properties: IgenerateLink = {
        cellPhone: telefonoContacto,
        email: emailContacto,
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
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
