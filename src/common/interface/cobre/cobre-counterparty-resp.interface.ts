export interface IrespuestaCounterParty {
  id: string;
  geo: string;
  type: string;
  alias: string;
  metadata: IMetadata;
  created_at: Date;
}

export interface IMetadata {
  counterparty_email: string;
  counterparty_fullname: string;
  counterparty_id_number: string;
  counterparty_id_type: string;
  counterparty_phone: string;
}
