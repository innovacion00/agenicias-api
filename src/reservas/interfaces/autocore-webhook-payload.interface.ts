export interface AutocoreWebhookPayload {
  external_ref_id: string;
  transaction_id?: string;
  payment_status: string;
  details?: {
    id?: string;
    pay_platform?: string;
  };
}

export type AutocoreWebhookSource = 'autocore' | 'billetera' | 'reprocess';

export interface AutocoreWebhookProcessOutcome {
  result?: 'applied' | 'noop' | 'skipped' | 'alert';
  reservaId?: string | null;
  reservaChatbotId?: string;
  reason?: string;
  paymentStatusClass?: string;
  statusBefore?: number | null;
  statusAfter?: number | null;
  shouldAlert?: boolean;
}
