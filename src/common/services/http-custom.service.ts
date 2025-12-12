import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import axios from 'axios';
import { v4 as uuid } from 'uuid';

import {
  autocoreHeaders,
  autocoreHeadersDev,
  envs,
  tiposAgencia,
} from 'src/config';

import {
  Iavailability,
  ICreateAgenciaBody,
  ICreateAgenciaResponce,
  ICreateLinkRecarga,
  ICreatePaymentLinkBody,
  ICreatePaymentLinkResponse,
  IdisponibilidadLayout,
  IGetSaldoAgencia,
  IPagoBilletera,
  IreservaAutocoreResp,
  IreservaInfo,
  IrespuestaAuthCobre,
  IrespuestaCounterParty,
  IrespuestaCreateBolcillo,
  IrespuestaGenerarLinkPago,
  MetadataLinkPago,
  reservaAutocoreUpdate,
  ValidCities,
} from '../interface';

@Injectable()
export class HttpCustomService {
  constructor() {}

  private logger = new Logger(HttpCustomService.name);

  // #region Controlador de errores
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
      if (!tokenInfo) {
        throw new Error('No se pudo obtener token de autenticación');
      }
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
      if (!tokenInfo) {
        throw new Error('No se pudo obtener token de autenticación');
      }

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
    external_id: string,
  ) {
    try {
      const tokenInfo = await this.generateAuthToken();
      if (!tokenInfo) {
        throw new Error('No se pudo obtener token de autenticación');
      }

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
    dev?: boolean,
  ) {
    try {
      const agencyType = tipoAgencia !== 0 ? tiposAgencia.mayorista : tiposAgencia.minorista;
      const url = `${dev ? envs.autocoreUrlDev : envs.autocoreUrl}/v2/bookings/agencies/${agencyType}/availability?checkin=${checkin}&nights=${night}&city=${city}`;
      const headers = dev ? autocoreHeadersDev : autocoreHeaders;
      
      // Construir el body
      const requestBody = { layout };
      
      // Log detallado de la solicitud
      this.logger.log('🌐 Llamando a Autocore API:', {
        url,
        method: 'POST',
        tipoAgencia,
        agencyType,
        checkin,
        nights: night,
        city,
        layout: JSON.stringify(layout),
        requestBody: JSON.stringify(requestBody),
        headers: {
          access_key: headers.headers.access_key ? '***' : 'MISSING',
          secret_key: headers.headers.secret_key ? '***' : 'MISSING',
        },
        isDev: dev,
      });
      
      // Hacer la solicitud con interceptor para debugging
      const axiosConfig = {
        ...headers,
        validateStatus: (status: number) => status < 600, // No lanzar error aún
      };

      const response = await axios.post<Iavailability[]>(
        url,
        requestBody,
        axiosConfig,
      );

      // Log de respuesta
      this.logger.log(`📡 Respuesta de Autocore [Status: ${response.status}]:`, {
        status: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        dataPreview: response.data ? JSON.stringify(response.data).substring(0, 200) : 'No data',
      });

      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(' Autocore retornó un status no exitoso:', {
          status: response.status,
          data: response.data,
        });
        throw new InternalServerErrorException(
          `Autocore retornó status ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }

      this.logger.log(' Respuesta Autocore exitosa');
      return response.data;
    } catch (error) {
      this.logger.error(' ERROR en getDisponibilidadAutocore:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      this.axiosError(error, this.getDisponibilidadAutocore.name);
    }
  }

  //? Crear reserva autocore agencia
  public async createReservaAutocore(
    hotelId: string,
    reservaInfo: IreservaInfo,
  ) {
    // Cambio debio a un problema de la propiedad source_of_bussiness de la base de datos y source_of_business de autocore
    const { agency, reservation } = reservaInfo;

    const { source_of_bussiness, ...reservationWithoutSource } = reservation;
    const reservationBody = {
      reservation: {
        ...reservationWithoutSource,
        source_of_business: reservation.source_of_bussiness,
      },
      agency,
    };
    try {
      const { data } = await axios.post(
        envs.autocoreUrl.concat(
          `/v2/bookings/hotel_id=${hotelId}?send_link=false`,
        ),
        { ...reservationBody },
        autocoreHeaders,
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
        autocoreHeaders,
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
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.cancelarReservas.name);
    }
  }

  //? Crear agencia autocore
  public async crearAgenciaAutocore(createAgenciaBody: ICreateAgenciaBody) {
    try {
      const { data } = await axios.post<ICreateAgenciaResponce>(
        envs.autocoreUrl.concat('/v2/agencies'),
        createAgenciaBody,
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.crearAgenciaAutocore.name);
    }
  }

  //? Set limite de recarga
  public async setLimiteRecargaAgencia(
    id: number,
    min_recharge_amount: number,
    max_recharge_amount: number,
  ) {
    try {
      const { data } = await axios.put<{ msg: string }>(
        envs.autocoreUrl.concat(`/v2/preloaded-balance/agencies/${id}/limits`),
        { min_recharge_amount, max_recharge_amount },
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.setLimiteRecargaAgencia.name);
    }
  }

  //? Crear link de pago
  public async createLinkPagoAutocore(
    createPaymentLinkBody: ICreatePaymentLinkBody,
  ) {
    try {
      const { data } = await axios.post<ICreatePaymentLinkResponse>(
        envs.autocoreUrl.concat('/v2/links/schedule/'),
        createPaymentLinkBody,
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.createLinkPagoAutocore.name);
    }
  }

  //? Reliazar pago con balance de agencia
  public async pagoBalanceAutocore(code: string) {
    try {
      const { data } = await axios.post<IPagoBilletera>(
        envs.autocoreUrl.concat('/v2/links/preloaded-balance'),
        { code },
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.pagoBalanceAutocore.name);
    }
  }

  //? Pagar reserva con balance Agencia
  public async pagoReservaBalanceAutocore(
    createPaymentLinkBody: ICreatePaymentLinkBody,
  ) {
    try {
      const { data } = await axios.post<ICreatePaymentLinkResponse>(
        envs.autocoreUrl.concat('/v2/links/schedule/'),
        createPaymentLinkBody,
        autocoreHeaders,
      );

      await this.pagoBalanceAutocore(data.code);

      return data;
    } catch (error) {
      this.axiosError(error, this.pagoReservaBalanceAutocore.name);
    }
  }

  //? Recargar billetera autocore
  public async recargarCarteraAutocore(
    amount: number,
    currency: string,
    agency_id: number,
  ) {
    try {
      const { data } = await axios.post<ICreateLinkRecarga>(
        envs.autocoreUrl.concat(`/v2/preloaded-balance/agencies/${agency_id}`),
        { amount, currency },
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.recargarCarteraAutocore.name);
    }
  }

  public async reembolsoCartera(
    idLink: string,
    agenciaId: number,
    chatbotId: string,
  ) {
    try {
      const { data } = await axios.post<{ msg: string }>(
        envs.autocoreUrl.concat(
          `/v2/preloaded-balance/${idLink}/agencies/${agenciaId}/reservation/${chatbotId}/refund`,
        ),
        {},
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.recargarCarteraAutocore.name);
    }
  }

  //? Obtener saldo autocore
  public async obtenerSaldoCartera(agency_id: number) {
    try {
      const { data } = await axios.get<IGetSaldoAgencia>(
        envs.autocoreUrl.concat(`/v2/preloaded-balance/agencies/${agency_id}`),
        autocoreHeaders,
      );

      return data;
    } catch (error) {
      this.axiosError(error, this.obtenerSaldoCartera.name);
    }
  }
}
