interface Agency {
    name:                    string;
    phone:                   string;
    rc_identifier:           null;
    country_code:            string;
    oneopay_user_id:         null;
    is_active:               boolean;
    nuvei_user_id:           null;
    email_for_notifications: string;
    document_type:           string;
    created_at:              Date;
    document_number:         string;
    id:                      number;
    hyperguest_token:        null;
    updated_at:              Date;
    is_archived:             boolean;
    cobre_account_id:        string;
}

export interface ICreateAgenciaBody {
  name: string;
  email_for_notifications: string;
  phone: string;
  country_code: string;
  document_type: string;
  document_number: string;
}

export interface ICreateAgenciaResponce {
    msg:    string;
    id:     number;
    agency: Agency;
}

