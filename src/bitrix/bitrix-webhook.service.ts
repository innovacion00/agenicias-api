import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { envs } from '../config/envs';

@Injectable()
export class BitrixWebhookService {
  private readonly logger = new Logger(BitrixWebhookService.name);

  async updateDeal(
    dealId: string | number,
    fields: Record<string, string | number>,
  ): Promise<boolean> {
    const base = envs.bitrixWebhookUrl;
    if (!base) {
      this.logger.warn(
        `[bitrix] ⚠️ BITRIX_WEBHOOK_URL no configurado; no se actualizó el deal ${dealId}`,
      );
      return false;
    }

    const params = new URLSearchParams();
    params.set('ID', String(dealId));
    for (const [key, value] of Object.entries(fields)) {
      params.set(`fields[${key}]`, String(value));
    }

    try {
      const res = await axios.post(
        `${base}/crm.deal.update`,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 15000,
        },
      );

      if (res.data?.result) {
        this.logger.log(
          `[bitrix] ✅ Deal ${dealId} actualizado: ${JSON.stringify(fields)}`,
        );
        return true;
      }
      this.logger.warn(
        `[bitrix] ⚠️ crm.deal.update sin confirmación para deal ${dealId}: ${JSON.stringify(res.data)}`,
      );
      return false;
    } catch (err: any) {
      const detalle =
        err?.response?.data?.error_description ||
        err?.response?.data?.error ||
        err?.message ||
        String(err);
      this.logger.error(
        `[bitrix] ❌ No se pudo actualizar el deal ${dealId}: ${detalle}`,
      );
      return false;
    }
  }
}