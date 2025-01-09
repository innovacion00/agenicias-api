import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import axios from 'axios';
import { v4 as uuid } from 'uuid';

import { envs } from 'src/config/envs';
import {
  Iavailability,
  IdisponibilidadLayout,
  IreservaAutocoreResp,
  IreservaInfo,
  IrespuestaAuthCobre,
  IrespuestaCounterParty,
  IrespuestaCreateBolcillo,
  IrespuestaGenerarLinkPago,
  MetadataLinkPago,
  ValidCities,
} from '../interface';
import { Types } from 'mongoose';
import { ErrorManager } from '../helpers';
import { reservaAutocoreUpdate } from '../interface/reserva';

@Injectable()
export class HttpCustomService {
  constructor() {}

  private logger = new Logger(HttpCustomService.name);

  // #region Generar auth token cobre
  public async generateAuthToken() {
    try {
      const { data } = await axios.post<IrespuestaAuthCobre>(
        envs.cobreApiUrl.concat('/v1/auth'),
        {
          user_id: envs.cobreUserId,
          secret: envs.cobreSecret,
        },
      );

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error('Error de la API:', error.response.data);
          throw new InternalServerErrorException(
            `La API de generar auth-token retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API generar auth-token. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud generar auth-token: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido generar auth-token:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud generar auth-token.',
        );
      }
    }
  }

  // #region Crear Bolcillo
  public async createBolcillo(nombre: string) {
    try {
      const tokenInfo = await this.generateAuthToken();
      const { data } = await axios.post<IrespuestaCreateBolcillo>(
        envs.cobreApiUrl.concat('/v1/accounts'),
        {
          provider_id: 'pr_col_cobre',
          action: 'create',
          alias: nombre,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenInfo.access_token}`,
          },
        },
      );

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(
            'Error de la API crear bolcillo:',
            error.response.data,
          );
          throw new InternalServerErrorException(
            `La API crear bolcillo retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API crear bolcillo. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud crear bolcillo: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud crear bolcillo.',
        );
      }
    }
  }

  // #region Crear Counter party
  public async createCounterParty(
    nombre: string,
    email: string,
    document: string,
    documentType: string,
    telefono: string,
  ) {
    try {
      const tokenInfo = await this.generateAuthToken();

      const { data } = await axios.post<IrespuestaCounterParty>(
        envs.cobreApiUrl.concat('/v1/counterparties'),
        {
          geo: 'col',
          type: 'r2p',
          alias: `${nombre} - Link de pago`,
          metadata: {
            counterparty_email: email,
            counterparty_fullname: nombre,
            counterparty_id_number: document,
            counterparty_id_type: documentType.toLowerCase(),
            counterparty_phone: telefono,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${tokenInfo.access_token}`,
          },
        },
      );

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error('Error de la API:', error.response.data);
          throw new InternalServerErrorException(
            `La API Crear Counter party retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API Crear Counter party. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud Crear Counter party: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud Crear Counter party.',
        );
      }
    }
  }

  // #region Crear link de pago
  public async generatePaymenLink(
    source_id: string,
    destination_id: string,
    amount: number,
    metadata: MetadataLinkPago,
    external_id: Types.ObjectId,
  ) {
    try {
      const tokenInfo = await this.generateAuthToken();

      const { data } = await axios.post<IrespuestaGenerarLinkPago>(
        envs.cobreApiUrl.concat('/v1/money_movements'),
        {
          source_id,
          destination_id,
          amount: amount * 100,
          metadata,
          external_id,
          checker_approval: false,
        },
        {
          headers: {
            Authorization: `Bearer ${tokenInfo.access_token}`,
            idempotency: uuid(),
          },
        },
      );

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error('Error de la API:', error.response.data);
          throw new InternalServerErrorException(
            `La API retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud.',
        );
      }
    }
  }

  // #region Disponibilidad
  public async getDisponibilidadAutocore(
    layout: IdisponibilidadLayout[],
    checkin: string,
    night: number,
    city: ValidCities,
    tipoAgencia: number,
  ) {
    try {
      const { data } = await axios.post<Iavailability[]>(
        `${envs.autocoreUrl}/v2/bookings/agencies/${tipoAgencia ? 'wholesale' : 'retailer'}/availability?checkin=${checkin}&nights=${night}&city=${city}`,
        { layout },
        {
          headers: {
            access_key: envs.autocoreAccessKey,
            secret_key: envs.autocoreSecretKey,
          },
        },
      );

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(
            'Error de la API get disponibilidad:',
            error.response.data,
          );
          throw new Error(
            `La API get disponibilidad retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API get disponibilidad. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud get disponibilidad: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud get disponibilidad.',
        );
      }
    }
  }

  // #region Realizar reserva autocore agencia
  public async createReservaAutocore(
    hotelId: string,
    reservaInfo: IreservaInfo,
  ) {
    try {
      const { data } = await axios.post(
        envs.autocoreUrl.concat(`/v2/bookings/hotel_id=${hotelId}?send_link=false`),
        { ...reservaInfo,  },
        {
          headers: {
            access_key: envs.autocoreAccessKey,
            secret_key: envs.autocoreSecretKey,
          },
        },
      );

      return data as IreservaAutocoreResp;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(
            'Error de la API get Crear reserva:',
            error.response.data,
          );
          throw new InternalServerErrorException(
            `La API get Crear reserva retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API get Crear reserva. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud get Crear reserva: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud get Crear reserva.',
        );
      }
    }
  }

  // #region editar reserva
  public async editarReservas(
    chatbotId: string,
    reservation: reservaAutocoreUpdate,
  ) {
    try {
      const { data } = await axios.put<{ msg: string }>(
        `${envs.autocoreUrl}/v2/bookings/chatbot/${chatbotId}`,
        { reservation },
        {
          headers: {
            access_key: envs.autocoreAccessKey,
            secret_key: envs.autocoreSecretKey,
          },
        },
      );

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(
            'Error de la API get Crear reserva:',
            error.response.data,
          );
          throw new InternalServerErrorException(
            `La API get Crear reserva retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API get Crear reserva. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud get Crear reserva: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud get Crear reserva.',
        );
      }
    }
  }

  // #region cancelar reserva
  public async cancelarReservas(chatbotId: string) {
    try {
      const { data } = await axios.delete<{ msg: string }>(
        `${envs.autocoreUrl}/v2/bookings/chatbot/${chatbotId}`,
        {
          headers: {
            access_key: envs.autocoreAccessKey,
            secret_key: envs.autocoreSecretKey,
          },
        },
      );

      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          this.logger.error(
            'Error de la API get Crear reserva:',
            error.response.data,
          );
          throw new InternalServerErrorException(
            `La API get Crear reserva retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
          );
        } else if (error.request) {
          this.logger.error('Error de red o timeout:', error.message);
          throw new InternalServerErrorException(
            'No se recibió respuesta de la API get Crear reserva. Verifique su conexión o tiempo de espera.',
          );
        } else {
          this.logger.error(
            'Error en la configuración de Axios:',
            error.message,
          );
          throw new InternalServerErrorException(
            `Error en la configuración de la solicitud get Crear reserva: ${error.message}`,
          );
        }
      } else {
        this.logger.error('Error desconocido:', error);
        throw new InternalServerErrorException(
          'Ocurrió un error desconocido al realizar la solicitud get Crear reserva.',
        );
      }
    }
  }
}
