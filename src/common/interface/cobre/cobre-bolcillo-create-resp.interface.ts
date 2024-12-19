export interface IrespuestaCreateBolcillo {
  id: string;
  connectivity: Connectivity;
  alias: string;
  metadata: Metadata;
  currency: string;
  geo: string;
  provider_id: string;
  provider_name: string;
  account_number: string;
  account_type: string;
  obtained_balance: number;
  obtained_balance_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Connectivity {
  status: string;
  description: string;
}

export interface Metadata {
  cobre_tag: string;
}
