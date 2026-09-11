import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppConfig } from './entities';

export const MAINTENANCE_KEY = 'mantenimiento';

@Injectable()
export class AppConfigService {
  constructor(
    @InjectModel(AppConfig.name)
    private readonly appConfigModel: Model<AppConfig>,
  ) {}

  private async getValue(key: string): Promise<unknown> {
    const doc = await this.appConfigModel.findOne({ key }).lean();
    return doc?.value ?? null;
  }

  async getEstado() {
    const mantenimiento = (await this.getValue(MAINTENANCE_KEY)) === true;
    return { mantenimiento };
  }

  async setMaintenance(activo: boolean) {
    await this.appConfigModel.updateOne(
      { key: MAINTENANCE_KEY },
      { $set: { value: activo } },
      { upsert: true },
    );
    return { mantenimiento: activo };
  }
}