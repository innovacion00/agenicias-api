/** Base pública donde MaarLab (OceanFlights) llama los webhooks (GET con query). */
export const MAARLAB_WEBHOOK_PUBLIC_BASE =
  process.env.MAARLAB_WEBHOOK_PUBLIC_BASE?.trim() ||
  'https://gehsuitesapps.com/agencias/v1/vuelos/maarlab/webhooks';

export type MaarlabWebhookUrls = {
  booking_url: string;
  payment_url: string;
  canceled_url: string;
  contracting_url: string;
};

export function buildMaarlabWebhookUrls(): MaarlabWebhookUrls {
  const base = MAARLAB_WEBHOOK_PUBLIC_BASE.replace(/\/$/, '');
  return {
    booking_url: `${base}/booking`,
    payment_url: `${base}/payment`,
    canceled_url: `${base}/canceled`,
    contracting_url: `${base}/contracting`,
  };
}
