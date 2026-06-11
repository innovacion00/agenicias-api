import { Injectable, Logger } from '@nestjs/common';

import axios from 'axios';
import { v4 as uuid } from 'uuid';

import { envs } from 'src/config';

import { axiosError } from 'src/common/helpers';

import {
  IrespuestaAuthCobre,
  IrespuestaCounterParty,
  IrespuestaCreateBolcillo,
  IrespuestaGenerarLinkPago,
  MetadataLinkPago,
} from './interfaces';

/**
 * Cliente HTTP de Cobre (bolsillos, counterparties y links de pago).
 * Extraído 1:1 de `HttpCustomService` (PR-2.2): cero cambios de
 * comportamiento, firmas idénticas.
 */
@Injectable()
export class CobreClient {
  constructor() {}

  private logger = new Logger(CobreClient.name);

  //? Generar token de autenticacion
  private async generateAuthToken() {
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
      axiosError(error, this.generateAuthToken.name, this.logger);
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
      axiosError(error, this.createBolcillo.name, this.logger);
    }
  }

  //? Crear counter party en cobre
  /**
   * @deprecated Sin consumidores conocidos (riesgo R7 del diseño de Fase 2).
   * Se eliminará en una PR posterior tras 30 días de logs sin invocaciones.
   */
  public async createCounterParty(
    nombre: string,
    email: string,
    document: string,
    documentType: string,
    telefono: string,
  ) {
    this.logger.warn(
      'DEPRECACION: createCounterParty fue invocado; este método no tiene consumidores conocidos y será eliminado (riesgo R7, Fase 2).',
    );
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
      axiosError(error, this.createCounterParty.name, this.logger);
    }
  }

  //? Crear link de pago cobre
  /**
   * @deprecated Sin consumidores conocidos (riesgo R7 del diseño de Fase 2).
   * Se eliminará en una PR posterior tras 30 días de logs sin invocaciones.
   */
  public async generatePaymenLink(
    source_id: string,
    destination_id: string,
    amount: number,
    metadata: MetadataLinkPago,
    external_id: string,
  ) {
    this.logger.warn(
      'DEPRECACION: generatePaymenLink fue invocado; este método no tiene consumidores conocidos y será eliminado (riesgo R7, Fase 2).',
    );
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
      axiosError(error, this.generatePaymenLink.name, this.logger);
    }
  }
}
