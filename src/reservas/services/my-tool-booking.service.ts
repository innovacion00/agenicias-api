import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';
import { v4 as uuid } from 'uuid';

import { envs } from 'src/config';
import {
  hotelMyToolConfig,
  MyToolHotelConfig,
  MY_TOOL_CANAL_VENTA_ID,
  MY_TOOL_MAQUINA_ID,
} from 'src/config/constants/myToolBookingConstants';
import { MyToolRoomDto } from '../dto/create-reserva-mytool.dto';

interface MyToolMappingItem {
  id: number;
  tipo: string;
  mapCode: number;
  mapName: string;
}

interface MyToolMappingsRawResponse {
  isSuccess: boolean;
  message: string;
  json: any;
  result: MyToolMappingItem[];
}

export interface MyToolMappings {
  categorias: MyToolMappingItem[];
  ratePlans: MyToolMappingItem[];
  segmentos: MyToolMappingItem[];
  subSegmentos: MyToolMappingItem[];
  motivos: MyToolMappingItem[];
  canalesVenta: MyToolMappingItem[];
}

export interface MyToolBookingResponse {
  isSuccess: boolean;
  message: string;
  localizador?: string;
  result?: any;
  json?: any;
}

interface CachedItem<T> {
  data: T;
  timestamp: number;
}

@Injectable()
export class MyToolBookingService {
  private readonly logger = new Logger(MyToolBookingService.name);

  private tokenCache = new Map<string, CachedItem<string>>();
  private readonly TOKEN_TTL = 50 * 60 * 1000; // 50 min (tokens suelen durar 1h)

  private mappingsCache = new Map<string, CachedItem<MyToolMappings>>();
  private readonly MAPPINGS_TTL = 5 * 60 * 1000; // 5 min

  private buildUrl(hotelIp: string, path: string): string {
    const base = hotelIp.replace(/\/+$/, '');
    return `${base}/api/${path}`;
  }

  private extractErrorDetails(error: any): {
    status: number | null;
    statusText: string;
    responseData: any;
    responseHeaders: any;
    requestUrl: string;
    requestMethod: string;
    message: string;
  } {
    if (error instanceof AxiosError && error.response) {
      return {
        status: error.response.status,
        statusText: error.response.statusText,
        responseData: error.response.data,
        responseHeaders: error.response.headers,
        requestUrl: error.config?.url || 'unknown',
        requestMethod: error.config?.method?.toUpperCase() || 'unknown',
        message: error.message,
      };
    }
    return {
      status: null,
      statusText: '',
      responseData: null,
      responseHeaders: null,
      requestUrl: 'unknown',
      requestMethod: 'unknown',
      message: error?.message || String(error),
    };
  }

  async authenticate(hotelIp: string, forceRefresh = false): Promise<string> {
    const cacheKey = hotelIp;
    const cached = this.tokenCache.get(cacheKey);

    if (
      !forceRefresh &&
      cached &&
      Date.now() - cached.timestamp < this.TOKEN_TTL
    ) {
      return cached.data;
    }

    try {
      const { data } = await axios.post<{ token: string; valido: string }>(
        this.buildUrl(hotelIp, 'Autenticacion/Validar'),
        {
          correo: envs.myToolEmail,
          clave: envs.myToolClave,
        },
        { timeout: 15000 },
      );

      this.tokenCache.set(cacheKey, { data: data.token, timestamp: Date.now() });
      this.logger.log(`Token MyTool obtenido para ${hotelIp}`);
      return data.token;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.logger.error(
        `[authenticate] ERROR ${details.status} | ${hotelIp} | Response: ${JSON.stringify(details.responseData)} | ${details.message}`,
      );
      throw error;
    }
  }

  private async authenticatedRequest<T>(
    hotelIp: string,
    requestFn: (token: string) => Promise<T>,
  ): Promise<T> {
    const token = await this.authenticate(hotelIp);
    try {
      return await requestFn(token);
    } catch (error) {
      if (error?.response?.status === 401) {
        this.logger.warn(`Token expirado para ${hotelIp}, renovando...`);
        const newToken = await this.authenticate(hotelIp, true);
        return await requestFn(newToken);
      }
      throw error;
    }
  }

  async getMappings(hotelSlug: string): Promise<MyToolMappings> {
    const cached = this.mappingsCache.get(hotelSlug);
    if (cached && Date.now() - cached.timestamp < this.MAPPINGS_TTL) {
      return cached.data;
    }

    const config = this.getHotelConfig(hotelSlug);

    try {
      const raw = await this.authenticatedRequest<MyToolMappingsRawResponse>(
        config.ip,
        (token) =>
          axios
            .get<MyToolMappingsRawResponse>(
              this.buildUrl(config.ip, 'BookingAvailability/getMappings'),
              {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000,
              },
            )
            .then((res) => res.data),
      );

      const items = raw.result || [];
      const data: MyToolMappings = {
        categorias: items.filter((i) => i.tipo === 'Categorias'),
        ratePlans: items.filter((i) => i.tipo === 'RatePlan'),
        segmentos: items.filter((i) => i.tipo === 'Segmentos'),
        subSegmentos: items.filter((i) => i.tipo === 'Sub Segmentos'),
        motivos: items.filter((i) => i.tipo === 'Motivos'),
        canalesVenta: items.filter((i) => i.tipo === 'Canal de Venta'),
      };

      this.mappingsCache.set(hotelSlug, { data, timestamp: Date.now() });
      this.logger.log(
        `Mappings obtenidos para ${hotelSlug}: ${data.categorias.length} categorias, ${data.ratePlans.length} ratePlans, ${data.canalesVenta.length} canales`,
      );
      this.logger.debug(
        `[getMappings] Categorias: ${JSON.stringify(data.categorias)}`,
      );
      this.logger.debug(
        `[getMappings] RatePlans: ${JSON.stringify(data.ratePlans)}`,
      );
      return data;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.logger.error(
        `[getMappings] ERROR ${details.status} | ${hotelSlug} | Response: ${JSON.stringify(details.responseData)} | ${details.message}`,
      );
      throw error;
    }
  }

  async createBooking(
    hotelSlug: string,
    checkin: string,
    nights: number,
    rooms: MyToolRoomDto[],
    solicitante: { titular: string; telefono: string; email: string },
    total: number,
    mappings: MyToolMappings,
    usuario: string,
  ): Promise<MyToolBookingResponse> {
    const config = this.getHotelConfig(hotelSlug);

    const checkout = this.calculateCheckout(checkin, nights);
    const localizador = this.generateLocalizador();

    const categoriaId = this.pickMapCode(mappings.categorias, 'St. Doble') ?? mappings.categorias[0]?.mapCode;
    const canalVentaId = this.pickMapCode(mappings.canalesVenta, 'Booking Connect') ?? MY_TOOL_CANAL_VENTA_ID;
    const ratePlanCode = this.pickMapCode(mappings.ratePlans, 'Booking Connect Neto')
      ?? this.pickMapCode(mappings.ratePlans, 'STANDAR B2B')
      ?? mappings.ratePlans[0]?.mapCode;
    const segmentoId = this.pickMapCode(mappings.segmentos, 'Tarifa Regular') ?? mappings.segmentos[0]?.mapCode ?? 1;
    const subSegmentoId = this.pickMapCode(mappings.subSegmentos, 'Tarifa Regular Portal Propio')
      ?? mappings.subSegmentos[0]?.mapCode ?? 1;
    const motivoId = this.pickMapCode(mappings.motivos, 'TURISMO') ?? mappings.motivos[0]?.mapCode ?? 8;

    this.logger.debug(
      `[createBooking] Valores de mappings → categoriaId=${categoriaId} | canalVentaId=${canalVentaId} | ratePlan=${ratePlanCode} | segmentoId=${segmentoId} | subSegmentoId=${subSegmentoId} | motivoId=${motivoId}`,
    );

    const pricePerNight = Math.round(total / (nights * rooms.length));

    const body = {
      checkIn: checkin,
      checkOut: checkout,
      usuario,
      maquinaId: MY_TOOL_MAQUINA_ID,
      solicitud: {
        titular: solicitante.titular,
        telefono: solicitante.telefono,
        email: solicitante.email,
      },
      bookData: {
        solicitante: {
          titular: solicitante.titular,
          telefono: solicitante.telefono,
          email: solicitante.email,
        },
        canalVentaId,
        ratePlan: String(ratePlanCode),
        paisCode: 'CO',
        monedaCode: 'COP',
        localizador,
        comision: 0,
        siAgregaImpto: false,
        acuerdos: `Precio por noche: ${pricePerNight} COP x ${nights} noches`,
        motivoId,
        subSegmentoId,
        segmentoId,
        agenciaId: 0,
        agenteId: 0,
      },
      rooms: rooms.map((room) => ({
        categoriaId,
        paxAdultos: room.paxAdultos,
        paxChilds: room.paxChilds,
        dayPrice: this.buildDayPrices(checkin, nights, pricePerNight),
        guest: room.guest.map((g) => ({
          documId: g.documId,
          documTypeId: g.documTypeId,
          name: g.name,
          firstLastName: g.firstLastName,
          secondLastName: g.secondLastName || '',
          birthDay: g.birthDay,
          nacionalityId: g.nacionalityId ?? 170,
          generId: g.generId,
          address: g.address || '',
          city: g.city || '',
          phone: g.phone,
          countryId: g.countryId ?? 57,
          email: g.email,
          isOwner: g.isOwner,
          image1: null,
          image2: null,
        })),
      })),
    };

    const targetUrl = this.buildUrl(config.ip, 'BookingAvailability/GetBookAvail');

    this.logger.debug(
      `[createBooking] POST ${targetUrl} | hotelSlug=${hotelSlug} checkin=${checkin} nights=${nights}`,
    );
    this.logger.debug(
      `[createBooking] Body enviado: ${JSON.stringify(body, null, 2)}`,
    );

    try {
      const data = await this.authenticatedRequest<MyToolBookingResponse>(
        config.ip,
        (token) =>
          axios
            .post<MyToolBookingResponse>(targetUrl, body, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 60000,
            })
            .then((res) => res.data),
      );

      this.logger.log(
        `Reserva creada en MyTool para ${hotelSlug}: ${localizador}`,
      );

      return {
        ...data,
        localizador,
      };
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.logger.error(
        `[createBooking] ERROR ${details.status} ${details.statusText} | ${details.requestMethod} ${details.requestUrl}`,
      );
      this.logger.error(
        `[createBooking] Response body: ${JSON.stringify(details.responseData, null, 2)}`,
      );
      this.logger.error(
        `[createBooking] Response headers: ${JSON.stringify(details.responseHeaders, null, 2)}`,
      );
      this.logger.error(
        `[createBooking] Request body enviado: ${JSON.stringify(body, null, 2)}`,
      );
      throw error;
    }
  }

  async cancelBooking(
    hotelSlug: string,
    localizador: string,
    usuario: string,
  ): Promise<MyToolBookingResponse> {
    const config = this.getHotelConfig(hotelSlug);

    const body = {
      localizador,
      canalVentaId: MY_TOOL_CANAL_VENTA_ID,
      usuarioCancela: usuario,
      maquinaId: MY_TOOL_MAQUINA_ID,
    };

    try {
      const data = await this.authenticatedRequest<MyToolBookingResponse>(
        config.ip,
        (token) =>
          axios
            .post<MyToolBookingResponse>(
              this.buildUrl(config.ip, 'BookingAvailability/cancelBookAvail'),
              body,
              {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000,
              },
            )
            .then((res) => res.data),
      );

      this.logger.log(`Reserva cancelada en MyTool: ${localizador}`);
      return data;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.logger.error(
        `[cancelBooking] ERROR ${details.status} | ${hotelSlug} | localizador=${localizador} | Response: ${JSON.stringify(details.responseData)} | ${details.message}`,
      );
      throw error;
    }
  }

  async searchBooking(
    hotelSlug: string,
    localizador: string,
    nombre: string,
  ): Promise<MyToolBookingResponse> {
    const config = this.getHotelConfig(hotelSlug);

    try {
      const data = await this.authenticatedRequest<MyToolBookingResponse>(
        config.ip,
        (token) =>
          axios
            .get<MyToolBookingResponse>(
              this.buildUrl(config.ip, 'BookingSearch'),
              {
                params: { localizador, nombre },
                headers: { Authorization: `Bearer ${token}` },
                timeout: 30000,
              },
            )
            .then((res) => res.data),
      );

      return data;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.logger.error(
        `[searchBooking] ERROR ${details.status} | ${hotelSlug} | localizador=${localizador} nombre=${nombre} | Response: ${JSON.stringify(details.responseData)} | ${details.message}`,
      );
      throw error;
    }
  }

  getHotelConfig(hotelSlug: string): MyToolHotelConfig {
    const config = hotelMyToolConfig[hotelSlug];
    if (!config) {
      throw new Error(`Hotel slug '${hotelSlug}' no configurado en MyTool`);
    }
    return config;
  }

  findSlugByAutocoreId(autocoreId: string): string | null {
    const entry = Object.entries(hotelMyToolConfig).find(
      ([, cfg]) => cfg.autocoreId === autocoreId,
    );
    return entry ? entry[0] : null;
  }

  findSlugByHotelName(hotelName: string): string | null {
    const nameLower = hotelName.toLowerCase();
    const entry = Object.entries(hotelMyToolConfig).find(([, cfg]) => {
      const cfgNameLower = cfg.name.toLowerCase();
      return (
        cfgNameLower === nameLower ||
        cfgNameLower.includes(nameLower) ||
        nameLower.includes(cfgNameLower)
      );
    });
    return entry ? entry[0] : null;
  }

  private calculateCheckout(checkin: string, nights: number): string {
    const date = new Date(checkin + 'T12:00:00');
    date.setDate(date.getDate() + nights);
    return date.toISOString().split('T')[0];
  }

  private generateLocalizador(): string {
    const short = uuid().replace(/-/g, '').substring(0, 10).toUpperCase();
    return `MT-${short}`;
  }

  private pickMapCode(
    items: MyToolMappingItem[],
    preferredName: string,
  ): number | undefined {
    if (!items?.length) return undefined;
    const nameLower = preferredName.toLowerCase();
    const match = items.find((i) =>
      i.mapName.toLowerCase().includes(nameLower),
    );
    return match?.mapCode;
  }

  private buildDayPrices(
    checkin: string,
    nights: number,
    pricePerNight: number,
  ): Array<{ fecha: string; precioBase: number }> {
    const prices: Array<{ fecha: string; precioBase: number }> = [];
    const startDate = new Date(checkin + 'T12:00:00');

    for (let i = 0; i < nights; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      prices.push({
        fecha: date.toISOString().split('T')[0],
        precioBase: pricePerNight,
      });
    }

    return prices;
  }
}
