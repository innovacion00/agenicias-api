import { ValidCities } from 'src/common/interface';

export interface IreservaInfo {
  agency: Agency;
  reservation: IreservaInfoBd;
}

export interface Agency {
  is_agency: boolean;
  agency_type: string;
  external_ref_id: string;
}

export interface IreservaInfoBd {
  adults: string;
  checkin: Date;
  checkout: Date;
  children: string;
  children_ages: string;
  city: ValidCities;
  country: string;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  nights: string;
  notes: string;
  rooms: string;
  roomsData: RoomsDatum[];
  telephone: string;
}

export interface RoomsDatum {
  adults: string;
  children: string;
  checkin: Date;
  checkout: Date;
  currency: string;
  id: string;
  quantity: string;
  rateId: string;
}
