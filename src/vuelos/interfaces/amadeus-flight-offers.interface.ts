// Interfaces para la API de Flight Offers de Amadeus
// Basadas en la documentación Swagger v2.8

export interface AmadeusFlightOffersRequest {
  currencyCode?: string;
  originDestinations: AmadeusOriginDestination[];
  travelers: AmadeusTraveler[];
  sources?: string[];
  searchCriteria?: AmadeusSearchCriteria;
}

export interface AmadeusOriginDestination {
  id: string;
  originLocationCode: string;
  destinationLocationCode: string;
  departureDateTimeRange: AmadeusDepartureDateTimeRange;
}

export interface AmadeusDepartureDateTimeRange {
  date: string; // YYYY-MM-DD
  time?: string; // HH:MM:SS
}

export interface AmadeusTraveler {
  id: string;
  travelerType: 'ADULT' | 'CHILD' | 'SENIOR' | 'YOUNG' | 'DISABLED' | 'DISABLED_CHILD' | 'ESCORT' | 'LARGE_FAMILY' | 'STUDENT';
}

export interface AmadeusSearchCriteria {
  maxFlightOffers?: number;
  flightFilters?: AmadeusFlightFilters;
}

export interface AmadeusFlightFilters {
  cabinRestrictions?: AmadeusCabinRestriction[];
  carrierRestrictions?: AmadeusCarrierRestriction[];
  priceRange?: AmadeusPriceRange;
  departureTimeRange?: AmadeusTimeRange;
  arrivalTimeRange?: AmadeusTimeRange;
  durationRange?: AmadeusDurationRange;
  connectionRestrictions?: AmadeusConnectionRestrictions;
}

export interface AmadeusCabinRestriction {
  cabin: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
  coverage: 'MOST_SEGMENTS' | 'AT_LEAST_ONE_SEGMENT' | 'ALL_SEGMENTS';
  originDestinationIds: string[];
}

export interface AmadeusCarrierRestriction {
  excludedCarrierCodes?: string[];
  includedCarrierCodes?: string[];
  excludedCarrierIds?: string[];
  includedCarrierIds?: string[];
}

export interface AmadeusPriceRange {
  min?: number;
  max?: number;
  currency?: string;
}

export interface AmadeusTimeRange {
  earliestTime?: string; // HH:MM:SS
  latestTime?: string; // HH:MM:SS
}

export interface AmadeusDurationRange {
  min?: number; // en minutos
  max?: number; // en minutos
}

export interface AmadeusConnectionRestrictions {
  maxNumberOfConnections?: number;
  maxConnectionDuration?: number; // en minutos
  maxPricePerConnection?: number;
  maxPricePerConnectionCurrency?: string;
}

// Respuesta de la API
export interface AmadeusFlightOffersResponse {
  data: AmadeusFlightOffer[];
  meta: AmadeusFlightOffersMeta;
}

export interface AmadeusFlightOffersMeta {
  count: number;
  links: {
    self: string;
  };
}

export interface AmadeusFlightOffer {
  type: string;
  id: string;
  source: string;
  instantTicketingRequired: boolean;
  nonHomogeneous: boolean;
  oneWay: boolean;
  lastTicketingDate: string;
  lastTicketingDateTime: string;
  numberOfBookableSeats: number;
  itineraries: AmadeusItinerary[];
  pricingOptions: AmadeusPricingOptions;
  validatingAirlineCodes: string[];
  travelerPricings: AmadeusTravelerPricing[];
}

export interface AmadeusItinerary {
  duration: string; // PT2H10M (ISO 8601)
  segments: AmadeusSegment[];
}

export interface AmadeusSegment {
  departure: AmadeusFlightLocation;
  arrival: AmadeusFlightLocation;
  carrierCode: string;
  number: string;
  aircraft: AmadeusAircraft;
  operating?: AmadeusOperating;
  duration: string;
  id: string;
  numberOfStops: number;
  blacklistedInEU: boolean;
}

export interface AmadeusFlightLocation {
  iataCode: string;
  terminal?: string;
  at: string; // ISO 8601 datetime
}

export interface AmadeusAircraft {
  code: string;
}

export interface AmadeusOperating {
  carrierCode: string;
}

export interface AmadeusPricingOptions {
  fareType: string[];
  includedCheckedBagsOnly: boolean;
}

export interface AmadeusTravelerPricing {
  travelerId: string;
  fareOption: string;
  travelerType: string;
  price: AmadeusPrice;
  fareDetailsBySegment: AmadeusFareDetailsBySegment[];
}

export interface AmadeusPrice {
  currency: string;
  total: string;
  base: string;
  fees: AmadeusFee[];
  grandTotal: string;
}

export interface AmadeusFee {
  amount: string;
  type: string;
}

export interface AmadeusFareDetailsBySegment {
  segmentId: string;
  cabin: string;
  fareBasis: string;
  brandedFare?: string;
  classOfService: string;
  includedCheckedBags: AmadeusBaggageAllowance;
}

export interface AmadeusBaggageAllowance {
  weight?: number;
  weightUnit?: string;
}

// Interfaces para errores
export interface AmadeusFlightOffersErrorResponse {
  errors: AmadeusFlightOffersError[];
}

export interface AmadeusFlightOffersError {
  status: number;
  code: number;
  title: string;
  detail?: string;
  source?: {
    parameter?: string;
    pointer?: string;
    example?: string;
  };
}
