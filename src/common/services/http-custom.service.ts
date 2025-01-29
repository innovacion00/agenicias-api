import {
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
import { reservaAutocoreUpdate } from '../interface/reserva';

@Injectable()
export class HttpCustomService {
  constructor() {}

  private logger = new Logger(HttpCustomService.name);

  private axiosError(error: any, apiName: string) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        this.logger.error(`Error de la API ${apiName}:`, error.response.data);
        throw new InternalServerErrorException(
          `La API ${apiName} retornó un error: ${error.response.status} - ${error.response.data.message || 'Sin mensaje'}`,
        );
      } else if (error.request) {
        this.logger.error(
          `Error de red o timeout API ${apiName}:`,
          error.message,
        );
        throw new InternalServerErrorException(
          `No se recibió respuesta de la API ${apiName}. Verifique su conexión o tiempo de espera.`,
        );
      } else {
        this.logger.error('Error en la configuración de Axios:', error.message);
        throw new InternalServerErrorException(
          `Error en la configuración de la solicitud API ${apiName} : ${error.message}`,
        );
      }
    } else {
      this.logger.error(`Error desconocido API ${apiName}:`, error);
      throw new InternalServerErrorException(
        `Ocurrió un error desconocido al realizar la solicitud API ${apiName}.`,
      );
    }
  }

  // #region Cobre

  //? Generar token de autenticacion
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
      this.axiosError(error, this.generateAuthToken.name);
    }
  }

  //? Crear bolcillo en cobre
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
      this.axiosError(error, this.createBolcillo.name);
    }
  }

  //? Crear counter party en cobre
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
      this.axiosError(error, this.createCounterParty.name);
    }
  }

  //? Crear link de pago cobre
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
      this.axiosError(error, this.generatePaymenLink.name);
    }
  }

  // #region Autocore

  //? Obtener disponibilidad
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
      this.axiosError(error, this.getDisponibilidadAutocore.name);
    }
  }

  //? Crear reserva autocore agencia
  public async createReservaAutocore(
    hotelId: string,
    reservaInfo: IreservaInfo,
  ) {
    try {
      const { data } = await axios.post(
        envs.autocoreUrl.concat(
          `/v2/bookings/hotel_id=${hotelId}?send_link=false`,
        ),
        { ...reservaInfo },
        {
          headers: {
            access_key: envs.autocoreAccessKey,
            secret_key: envs.autocoreSecretKey,
          },
        },
      );

      return data as IreservaAutocoreResp;
    } catch (error) {
      this.axiosError(error, this.createReservaAutocore.name);
    }
  }

  //? Editar reserva
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
      this.axiosError(error, this.editarReservas.name);
    }
  }

  //? Cancelar reserva
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
      this.axiosError(error, this.cancelarReservas.name);
    }
  }
}
