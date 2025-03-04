export interface ICreatePaymentLinkBody {
  hotel_id: number;
  guest_name: string;
  email: string;
  phone: string;
  amount: number;
  booking_dates: string;
  description: string;
  available_hours: number;
  source: string;
  external_ref_id: string;
  reservation_id?: string;
  temp_webhook_url: string;
  redirect: Redirect;
  agency_id: number;
}

export interface Redirect {
  success_url: string;
  failure_url: string;
}

export interface ICreatePaymentLinkResponse {
  msg: string;
  url: string;
  code: string;
}
