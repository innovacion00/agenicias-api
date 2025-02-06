export interface IPagoBilletera {
  msg: string;
  new_balance: number;

  code?: string;
  message?: string;
  detail?: string;
}
