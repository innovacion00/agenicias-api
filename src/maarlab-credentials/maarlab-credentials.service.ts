import {
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MaarlabPartnerCredential } from './entities/maarlab-partner-credential.entity';
import { normalizeMaarlabAgencyName } from './normalize-maarlab-agency-name';

@Injectable()
export class MaarlabCredentialsService {
  constructor(
    @InjectModel(MaarlabPartnerCredential.name)
    private readonly model: Model<MaarlabPartnerCredential>,
  ) {}

  /**
   * Orden: credencial vinculada por `agenciaId` → misma `normHotelName` que la agencia → campo legado `maarlabApiKey`.
   */
  async resolveBearerForAgencia(agencia: {
    _id: Types.ObjectId;
    fullName: string;
    maarlabApiKey?: string;
  }): Promise<string> {
    const norm = normalizeMaarlabAgencyName(agencia.fullName);

    const byLink = await this.model
      .findOne({ agenciaId: agencia._id })
      .sort({ lastSyncedAt: -1 })
      .select('apiKey')
      .lean()
      .exec();

    if (byLink?.apiKey?.trim()) {
      return byLink.apiKey.trim();
    }

    if (norm) {
      const byName = await this.model
        .findOne({ normHotelName: norm })
        .sort({ lastSyncedAt: -1 })
        .select('apiKey')
        .lean()
        .exec();

      if (byName?.apiKey?.trim()) {
        return byName.apiKey.trim();
      }
    }

    const legacy =
      typeof agencia.maarlabApiKey === 'string'
        ? agencia.maarlabApiKey.trim()
        : '';
    if (legacy) {
      return legacy;
    }

    throw new BadRequestException(
      'Esta agencia no tiene API key de MaarLab: sincroniza con el script de partner o configura maarlabApiKey.',
    );
  }
}
