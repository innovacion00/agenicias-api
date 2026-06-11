export interface Iavailability {
  hotel: Hotel;
  availability: AvailabilityElement[];
}

export interface AvailabilityElement {
  adults: number;
  children_ages: string;
  total_count: number;
  available_rooms: AvailableRoom[];
}

export interface AvailableRoom {
  roomId: string;
  roomName: string;
  beds: number;
  adults: number;
  children_ages: string;
  count: number;
  products: Product[];
}

export interface Product {
  roomId: string;
  roomName: string;
  roomType: RoomType;
  rateId: string;
  rateDescription: string;
  boardType: null;
  boardTypeDescription: BoardTypeDescription;
  refundable: Refundable;
  cancellationPolicy: CancellationPolicy;
  currency: Currency;
  baseDailyAmounts: BaseDailyAmount[];
  baseRate: BaseRate;
}

export interface BaseDailyAmount {
  day: Date;
  amountAfterTax: number;
  amountBeforeTax: number;
}

export interface BaseRate {
  amountBeforeTax: number;
  amountAfterTax: number;
}

export enum BoardTypeDescription {
  NoEspecificado = 'NO ESPECIFICADO',
}

export enum CancellationPolicy {
  TheGuestCanCancelFreeOfChargeUntilTheDayOfArrival = 'The guest can cancel free of charge until the day of arrival.',
}

export enum Currency {
  Cop = 'COP',
}

export enum Refundable {
  Full = 'full',
}

export enum RoomType {
  Double = 'DOUBLE',
  Family = 'FAMILY',
  Quadruple = 'QUADRUPLE',
  Triple = 'TRIPLE',
}

export interface Hotel {
  id: number;
  name: string;
  roomcloud_id: string;
  city: string;
  largest_room_beds: number;
}
