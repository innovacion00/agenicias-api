import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';

import { v4 as uuid } from 'uuid';

import { envs } from 'src/config/envs';
import { ICobreLinkAPIResponse, IgenerateLink } from '../interface';

@Injectable()
export class HttpCustomService {
  constructor() {}

  private logger = new Logger(HttpCustomService.name);

  public async generateCobreJwt() {
    const urlencoded = new URLSearchParams();
    urlencoded.append('grant_type', 'client_credentials');

    const requestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
        Authorization: `Basic ${envs.cobreAuthString}`,
        'X-API-KEY': envs.cobreApiKey,
      },
      body: urlencoded,
    };

    const response = await fetch(
      envs.cobreApiUrl.concat('api-auth/v1/util/tokens'),
      requestOptions,
    );

    if (response.ok) {
      const result = await response.json();
      const cobreAuthToken = result.access_token;
      return { cobreAuthToken };
    } else {
      const errorMessage = await response.text();
      this.logger.log({ code: response.status, message: errorMessage });
      throw new InternalServerErrorException();
    }
  }

  public async generateCobreLink(properties: IgenerateLink) {
    interface IBody extends Omit<IgenerateLink, 'jwt'> {
      notificationMethods: ('EMAIL' | 'WHATSAPP' | 'ONLINE')[];
      enabledPaymentMethods: 'PSE'[];
      currency: 'COP';
    }

    const myHeaders = {
      'X-API-KEY': envs.cobreApiKey,
      'X-APIGW-AUTH': properties.jwt,
      'X-CORRELATION-ID': uuid(),
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };

    const {
      cellPhone,
      email,
      amount,
      document,
      documentType,
      expirationDate,
      fullName,
      description,
      references,
      redirectUrl,
    } = properties;

    const bodyData: IBody = {
      cellPhone,
      email,
      amount,
      document,
      documentType,
      expirationDate,
      fullName,
      description,
      references,
      // TODO: Volver a activar notificaciones
      // notificationMethods: ['EMAIL', 'WHATSAPP', 'ONLINE'],
      notificationMethods: [],
      enabledPaymentMethods: ['PSE'],
      currency: 'COP',
      redirectUrl,
    };

    const requestOptions = {
      method: 'POST',
      headers: myHeaders,
      body: JSON.stringify(bodyData),
    };

    const result = await fetch(
      envs.cobreApiUrl.concat(
        'workplace-bank-cash-in/v1/task/cash-in-links/referenced',
      ),
      requestOptions,
    )
      .then((response) => response.json())
      .then((result) => {
        const data: ICobreLinkAPIResponse = result;
        return data;
      })
      .catch((error) => {
        throw new Error(error);
      });

    return result;
  }
}
