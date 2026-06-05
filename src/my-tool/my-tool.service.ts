import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { ErrorManager } from 'src/common/helpers';
import { hotelesIps, envs } from 'src/config'; 
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
        `${envs.apiAvexi}:59000/api/Autenticacion/Validar`,
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
      for (const hotelIp of hotelesIps) {
        try {
          reservaData = await axios.get(`${hotelIp}:59000/api/BookingSearch`, {
            params: {
              localizador,
              nombre,
            },
            headers: {
              Authorization: `Bearer ${validationToken}`,
            },
            timeout: 60000,
          });

          if (reservaData.data.isSuccess) {
            return reservaData.data;
          }
        } catch (error) {
          this.logger.warn(`Error en ${hotelIp}: ${error.message}`);
        }
      }

      reservaData = {
        data: {
          isSuccess: false,
          message: 'Reserva inexistente según criterios de busqueda',
          json: null,
          result: null,
        },
      };
      return reservaData.data;
    } catch (error) {
      this.logger.error('Error final en reservaInfoRequest:', error.message);
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
