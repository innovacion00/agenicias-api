import { ValidCities } from 'src/common/interface';

export interface IreservaInfo {
  agency: Agency;
  reservation: IreservaInfoBd;
}

export interface Agency {
  is_agency: boolean;
  agency_type: string | number;
  external_ref_id: string;
}

export interface IreservaInfoBd {
  adults: string;
  checkin: string;
  checkout: string;
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
  checkin: string;
  checkout: string;
  currency: string;
  id: string;
  quantity: string;
  rateId: string;
  unitaryPrice: number;
}
