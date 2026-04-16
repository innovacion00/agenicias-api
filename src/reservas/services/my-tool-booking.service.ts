import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError } from 'axios';

import { envs } from 'src/config';
import {
  hotelMyToolConfig,
  MyToolHotelConfig,
  MY_TOOL_CANAL_VENTA_ID,
  MY_TOOL_MAQUINA_ID,
} from 'src/config/constants/myToolBookingConstants';

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
  private readonly TOKEN_TTL = 50 * 60 * 1000;

  private mappingsCache = new Map<string, CachedItem<MyToolMappings>>();
  private readonly MAPPINGS_TTL = 5 * 60 * 1000;

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
      return data;
    } catch (error) {
      const details = this.extractErrorDetails(error);
      this.logger.error(
        `[getMappings] ERROR ${details.status} | ${hotelSlug} | Response: ${JSON.stringify(details.responseData)} | ${details.message}`,
      );
      throw error;
    }
  }

  /**
   * Reenvía el body exacto tal cual a MyTool sin transformación.
   * El body debe tener la estructura: { hotelId, checkIn, checkOut, usuario, maquinaId, bookData, rooms }
   */
  async createBooking(
    hotelSlug: string,
    myToolBody: Record<string, any>,
  ): Promise<MyToolBookingResponse> {
    const config = this.getHotelConfig(hotelSlug);
    const targetUrl = this.buildUrl(config.ip, 'BookingAvailability/GetBookAvail');

    this.logger.debug(
      `[createBooking] POST ${targetUrl} | hotelSlug=${hotelSlug}`,
    );
    this.logger.debug(
      `[createBooking] Body enviado: ${JSON.stringify(myToolBody, null, 2)}`,
    );

    try {
      const data = await this.authenticatedRequest<MyToolBookingResponse>(
        config.ip,
        (token) =>
          axios
            .post<MyToolBookingResponse>(targetUrl, myToolBody, {
              headers: { Authorization: `Bearer ${token}` },
              timeout: 60000,
            })
            .then((res) => res.data),
      );

      this.logger.log(
        `Reserva creada en MyTool para ${hotelSlug}: localizador=${myToolBody.bookData?.localizador}`,
      );

      return data;
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
        `[createBooking] Request body enviado: ${JSON.stringify(myToolBody, null, 2)}`,
      );
      throw error;
    }
  }

  async cancelBooking(
    hotelSlug: string,
    localizador: string,
    usuario: string,
    canalVentaId?: number,
  ): Promise<MyToolBookingResponse> {
    const config = this.getHotelConfig(hotelSlug);

    const body = {
      localizador,
      canalVentaId: canalVentaId ?? MY_TOOL_CANAL_VENTA_ID,
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
}
