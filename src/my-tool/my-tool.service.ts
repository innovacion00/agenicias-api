import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ErrorManager } from 'src/common/helpers';
import { envs } from 'src/config/envs';
import { ReservaInfoDto } from './dto';
import { hotelesIps } from 'src/config';

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
        `${envs.apiAixo}:59000/api/Autenticacion/Validar`,
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

  private async reservaInfoRequest(
    localizador: string,
    nombre: string,
    validationToken: string,
  ) {
    let reservaData = {
      data: {
        isSuccess: false,
        message: 'Reserva inexistente según criterios de busqueda',
        json: null,
        result: null,
      },
    };
    try {
      for (let i = 0; i < hotelesIps.length; i++) {
        const hotelIp = hotelesIps[i];
        reservaData = await axios.get(`${hotelIp}:59000/api/BookingSearch`, {
          params: {
            localizador,
            nombre,
          },
          headers: {
            Authorization: `Bearer ${validationToken}`,
          },
        });
        if (reservaData.data.isSuccess) {
          return reservaData.data;
        }
      }

      return reservaData.data;
    } catch (error) {
      this.logger.error(error);
      this.errorManager.handle(error);
    }
  }

  async getReservaInfo(reservaInfo: ReservaInfoDto) {
    const validationToken = await this.generateMyToolToken();

    const data = await this.reservaInfoRequest(
      reservaInfo.localizador,
      reservaInfo.nombre,
      validationToken,
    );

    return data;
  }
}
