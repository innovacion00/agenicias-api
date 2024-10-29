import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ErrorManager } from 'src/common/helpers';
import { envs } from 'src/config/envs';
import { ReservaInfoDto } from './dto';

@Injectable()
export class MyToolService {
  private readonly errorManager: ErrorManager;
  private readonly logger = new Logger(MyToolService.name);

  constructor() {
    this.errorManager = new ErrorManager(MyToolService.name);
  }

  private async generateMyToolToken() {
    try {
      const rawData = await axios.post<{ token: string; valido: string }>(
        `${envs.api_1525}:59000/api/Autenticacion/Validar`,
        {
          correo: envs.myToolEmail,
          clave: envs.myToolClave,
        },
      );
      return rawData.data.token;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  private hotelSelector(hotel: string) {
    switch (hotel) {
      case '1525':
        return envs.api_1525;
      default:
        return null;
    }
  }

  async getReservaInfo(reservaInfo: ReservaInfoDto) {
    const validationToken = await this.generateMyToolToken();
    const hotelIp = this.hotelSelector(reservaInfo.hotel);
    const url = `${hotelIp}:59000/api/BookingSearch`;

    try {
      const reservaData = await axios.get(url, {
        params: {
          localizador: reservaInfo.localizador,
          nombre: reservaInfo.nombre,
        },
        headers: {
          Authorization: `Bearer ${validationToken}`,
        },
      });

      return reservaData.data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }
}
