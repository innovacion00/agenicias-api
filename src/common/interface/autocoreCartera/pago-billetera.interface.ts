export interface IPagoBilletera {
  msg: string;
  new_balance: number;

  code?: string;
  message?: string;
  detail?: string;

  new_cashback?: number;
  total_available_amount?: number;

  details?: {
    id?: string;
    transaction_id?: string;
    external_ref_id?: string;
    type?: string;
    amount?: number;
    currency?: string;
    status_code?: string;
    status_detail?: string;
    comments?: string;
    transaction_date?: string;
  };
}
