export interface IGetSaldoAgencia {
  id: number;
  updated_at: string;
  name: string;
  agency_id: number;
  min_recharge_amount: number;
  created_at: string;
  is_archived: boolean;
  description: string;
  available_amount: number;
  max_recharge_amount: number;
}
