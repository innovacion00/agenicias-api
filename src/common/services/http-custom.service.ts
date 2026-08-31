import {
  BadRequestException,
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
  IreservaInfoBd,
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

  private isAlreadyCanceledResponse(error: any): boolean {
    if (!axios.isAxiosError(error) || !error.response) {
      return false;
    }

    const status = error.response.status;
    const data = error.response.data || {};
    const rawMessage = (data?.message || data?.msg || data?.error || '')
      .toString()
      .toLowerCase();

    const hasCancellationHint =
      rawMessage.includes('already') ||
      rawMessage.includes('cancelad') ||
      rawMessage.includes('not found') ||
      rawMessage.includes('no encontrada') ||
      rawMessage.includes('no existe');

    return (
      (status === 404 || status === 409 || status === 400) &&
      hasCancellationHint
    );
  }

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
    this.logger.log(`[cobre] Creando bolcillo: nombre="${nombre}"`);
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

      this.logger.log(`[cobre] ✅ Bolcillo creado: id=${data.id}`);
      return data;
    } catch (error) {
      this.logger.error(`[cobre] ❌ Error creando bolcillo "${nombre}"`);
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
      const agencyType =
        tipoAgencia !== 0 ? tiposAgencia.mayorista : tiposAgencia.minorista;
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
      this.logger.log(
        `📡 Respuesta de Autocore [Status: ${response.status}]:`,
        {
          status: response.status,
          statusText: response.statusText,
          hasData: !!response.data,
          dataPreview: response.data
            ? JSON.stringify(response.data).substring(0, 200)
            : 'No data',
        },
      );

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

  //? Obtener disponibilidad para personas
  public async getDisponibilidadPersonas(
    hotelId: string,
    checkin: string,
    nights: number,
    adults: number,
    childrenAges?: string,
    roomType?: string,
    dev?: boolean,
  ) {
    try {
      // Construir query parameters
      const queryParams = new URLSearchParams();
      queryParams.append('hotel_id', hotelId);
      queryParams.append('checkin', checkin);
      queryParams.append('nights', nights.toString());
      queryParams.append('adults', adults.toString());

      if (childrenAges) {
        queryParams.append('children_ages', childrenAges);
      }

      if (roomType) {
        queryParams.append('room_type', roomType);
      }

      const url = `${dev ? envs.autocoreUrlDev : envs.autocoreUrl}/v2/bookings/availability?${queryParams.toString()}`;
      const headers = dev ? autocoreHeadersDev : autocoreHeaders;

      // Log detallado de la solicitud
      this.logger.log('🌐 Llamando a Autocore API (Personas):', {
        url,
        method: 'GET',
        hotelId,
        checkin,
        nights,
        adults,
        childrenAges,
        roomType,
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

      const response = await axios.get<Iavailability[]>(url, axiosConfig);

      // Log de respuesta
      this.logger.log(
        ` Respuesta de Autocore (Personas) [Status: ${response.status}]:`,
        {
          status: response.status,
          statusText: response.statusText,
          hasData: !!response.data,
          dataPreview: response.data
            ? JSON.stringify(response.data).substring(0, 200)
            : 'No data',
        },
      );

      if (response.status !== 200 && response.status !== 201) {
        this.logger.error(
          ' Autocore retornó un status no exitoso (Personas):',
          {
            status: response.status,
            data: response.data,
          },
        );
        throw new InternalServerErrorException(
          `Autocore retornó status ${response.status}: ${JSON.stringify(response.data)}`,
        );
      }

      this.logger.log(' Respuesta Autocore exitosa (Personas)');
      return response.data;
    } catch (error) {
      this.logger.error(' ERROR en getDisponibilidadPersonas:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      this.axiosError(error, this.getDisponibilidadPersonas.name);
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

  //? Crear reserva autocore personas
  public async createReservaPersonasAutocore(
    hotelId: string,
    reservation: IreservaInfoBd,
  ) {
    const { source_of_bussiness, ...reservationWithoutSource } = reservation;
    const reservationBody = {
      reservation: {
        ...reservationWithoutSource,
        source_of_business: source_of_bussiness || 'Booking Personas',
      },
    };

    try {
      this.logger.log('🌐 Creando reserva de persona en Autocore:', {
        hotelId,
        url: `${envs.autocoreUrl}/v2/bookings/agencies/retailer/hotel_id=${hotelId}?send_link=false`,
        reservation: JSON.stringify(reservationBody),
      });

      const { data } = await axios.post(
        envs.autocoreUrl.concat(
          `/v2/bookings/agencies/retailer/hotel_id=${hotelId}?send_link=false`,
        ),
        reservationBody,
        autocoreHeaders,
      );

      this.logger.log('✅ Reserva de persona creada exitosamente en Autocore');
      return data as IreservaAutocoreResp;
    } catch (error) {
      this.logger.error('❌ ERROR al crear reserva de persona en Autocore:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      this.axiosError(error, this.createReservaPersonasAutocore.name);
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

      return { ...data, alreadyCanceled: false };
    } catch (error) {
      if (this.isAlreadyCanceledResponse(error)) {
        return {
          msg: `Reserva ${chatbotId} ya estaba cancelada en Autocore`,
          alreadyCanceled: true,
        };
      }
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        this.logger.error(
          `Autocore cancel 404: chatbotId=${chatbotId}`,
          error.response?.data,
        );
        throw new BadRequestException(
          `No se encontró la reserva  "${chatbotId}" (HTTP 404). ` +
            `Verifique si la reserva no fue cancelada previamente, ` +
            `espere unos minutos a que se actualice el estado de la reserva` +
            `en caso de que no se actualice el estado consultar con el equipo de reservas`,
        );
      }
      this.axiosError(error, this.cancelarReservas.name);
    }
  }

  //? Crear agencia autocore
  public async crearAgenciaAutocore(createAgenciaBody: ICreateAgenciaBody) {
    this.logger.log(
      `[autocore] Creando agencia: name="${createAgenciaBody.name}", email=${createAgenciaBody.email_for_notifications}`,
    );
    try {
      const { data } = await axios.post<ICreateAgenciaResponce>(
        envs.autocoreUrl.concat('/v2/agencies'),
        createAgenciaBody,
        autocoreHeaders,
      );

      this.logger.log(`[autocore] ✅ Agencia creada: id=${data.id}`);
      return data;
    } catch (error) {
      this.logger.error(
        `[autocore] ❌ Error creando agencia "${createAgenciaBody.name}"`,
      );
      this.axiosError(error, this.crearAgenciaAutocore.name);
    }
  }

  //? Set limite de recarga
  public async setLimiteRecargaAgencia(
    id: number,
    min_recharge_amount: number,
    max_recharge_amount: number,
  ) {
    this.logger.log(
      `[autocore] Seteando límites de recarga: agencyId=${id}, min=${min_recharge_amount}, max=${max_recharge_amount}`,
    );
    try {
      const { data } = await axios.put<{ msg: string }>(
        envs.autocoreUrl.concat(`/v2/preloaded-balance/agencies/${id}/limits`),
        { min_recharge_amount, max_recharge_amount },
        autocoreHeaders,
      );

      this.logger.log(`[autocore] ✅ Límites seteados para agencyId=${id}`);
      return data;
    } catch (error) {
      this.logger.error(
        `[autocore] ❌ Error seteando límites para agencyId=${id}`,
      );
      this.axiosError(error, this.setLimiteRecargaAgencia.name);
    }
  }

  //? Crear link de pago
  public async createLinkPagoAutocore(
    createPaymentLinkBody: ICreatePaymentLinkBody,
  ) {
    this.logger.log(
      `[autocore] Creando link de pago: hotelId=${createPaymentLinkBody.hotel_id}, amount=${createPaymentLinkBody.amount}, agency=${createPaymentLinkBody.agency_id}`,
    );
    try {
      const { data } = await axios.post<ICreatePaymentLinkResponse>(
        envs.autocoreUrl.concat('/v2/links/schedule/'),
        createPaymentLinkBody,
        autocoreHeaders,
      );

      this.logger.log(
        `[autocore] ✅ Link de pago creado: code=${data.code}`,
      );
      return data;
    } catch (error) {
      this.logger.error(`[autocore] ❌ Error creando link de pago`);
      this.axiosError(error, this.createLinkPagoAutocore.name);
    }
  }

  //? Crear link de pago para personas (sin agency_id)
  public async createLinkPagoPersonasAutocore(
    hotelId: number,
    guestName: string,
    email: string,
    phone: string,
    amount: number,
    bookingDates: string,
    description: string,
    currency = 'COP',
    externalRefId?: string,
    reservationId?: string, // Opcional: ID de reserva si ya existe
  ) {
    try {
      // Según la documentación de Autocore API:
      // reservation_id: TYPE String, REQ.: No
      // "Reference to the associated reservation, if available."
      // Por lo tanto, es OPCIONAL y solo se incluye si hay una reserva existente
      const paymentLinkBody: any = {
        hotel_id: hotelId,
        guest_name: guestName,
        email,
        phone,
        amount,
        booking_dates: bookingDates,
        description,
        available_hours: 0.1666, // 10 minutos
        currency,
        source: 'Booking Personas',
        external_ref_id:
          externalRefId ||
          `personas_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        temp_webhook_url: `${envs.paymentWebhookUrl}/agencias/v1/booking-personas/change-status`,
        redirect: {
          success_url: 'https://personas.gehsuites.com/reserva-exitosa',
          failure_url: 'https://personas.gehsuites.com/reserva-error',
        },
      };

      // Solo incluir reservation_id si se proporciona un valor válido
      // Si no se proporciona, el campo no se envía (es opcional según Autocore)
      if (reservationId && reservationId.trim() !== '') {
        paymentLinkBody.reservation_id = reservationId;
      }

      this.logger.log(' Creando link de pago para personas:', {
        hotelId,
        amount,
        guestName,
        email,
      });

      const { data } = await axios.post<ICreatePaymentLinkResponse>(
        envs.autocoreUrl.concat('/v2/links/schedule/'),
        paymentLinkBody,
        autocoreHeaders,
      );

      this.logger.log(' Link de pago creado exitosamente');
      return data;
    } catch (error) {
      this.logger.error(' ERROR al crear link de pago para personas:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      this.axiosError(error, this.createLinkPagoPersonasAutocore.name);
    }
  }

  //? Reliazar pago con balance de agencia
  public async pagoBalanceAutocore(code: string) {
    this.logger.log(`[autocore] Procesando pago con balance: code=${code}`);
    try {
      const { data } = await axios.post<IPagoBilletera>(
        envs.autocoreUrl.concat('/v2/links/preloaded-balance'),
        { code },
        autocoreHeaders,
      );

      this.logger.log(
        `[autocore] ✅ Pago con balance procesado: code=${code}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `[autocore] ❌ Error en pago con balance: code=${code}`,
      );
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
    this.logger.log(
      `[autocore] Recargando billetera: agencyId=${agency_id}, amount=${amount}, currency=${currency}`,
    );
    try {
      const { data } = await axios.post<ICreateLinkRecarga>(
        envs.autocoreUrl.concat(`/v2/preloaded-balance/agencies/${agency_id}`),
        { amount, currency },
        autocoreHeaders,
      );

      this.logger.log(
        `[autocore] ✅ Link de recarga creado: agencyId=${agency_id}`,
      );
      return data;
    } catch (error) {
      this.logger.error(
        `[autocore] ❌ Error recargando billetera: agencyId=${agency_id}`,
      );
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
