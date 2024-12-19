import { Types } from 'mongoose';

export interface IrespuestaGenerarLinkPago {
  id: string;
  status: Status;
  metadata: MetadataRespLinkPago;
  creator: string;
  external_id: string;
  checker_approval: boolean;
  mm_approval_id: string;
  type: string;
  geo: string;
  source_id: Types.ObjectId;
  destination_id: string;
  currency: string;
  amount: number;
  created_at: Date;
  updated_at: Date;
}

export interface MetadataLinkPago {
  r2p_methods: string[];
  description_to_payer: string;
  redirect_url: string;
  description_to_beneficiary_account: string;
  valid_until: Date;
}

export interface MetadataRespLinkPago {
  description_to_payer: string;
  pse_bank_code: string;
  description_to_beneficiary_account: string;
  redirect_url: string;
  payment_link: string;
  valid_until: string;
  r2p_methods: string[];
  tracking_key: string;
}

export interface Status {
  state: string;
  code: string;
  description: string;
}
