// Interfaces extendidas solo para el enriquecimiento de flight-offers
// Estas NO afectan las interfaces originales de Amadeus

export interface EnrichedFlightLocation {
  iataCode: string;
  cityName: string; // Campo agregado para enriquecimiento
  terminal?: string;
  at: string;
}

export interface EnrichedFlightSegment {
  departure: EnrichedFlightLocation;
  arrival: EnrichedFlightLocation;
  carrierCode: string;
  number: string;
  aircraft: {
    code: string;
  };
  operating?: {
    carrierCode: string;
  };
  duration: string;
  id: string;
  numberOfStops: number;
  blacklistedInEU: boolean;
}

export interface EnrichedFlightItinerary {
  duration: string;
  segments: EnrichedFlightSegment[];
}

export interface EnrichedFlightOffer {
  type: string;
  id: string;
  source: string;
  instantTicketingRequired: boolean;
  nonHomogeneous: boolean;
  oneWay: boolean;
  lastTicketingDate: string;
  lastTicketingDateTime: string;
  numberOfBookableSeats: number;
  itineraries: EnrichedFlightItinerary[];
  pricingOptions: {
    fareType: string[];
    includedCheckedBagsOnly: boolean;
  };
  validatingAirlineCodes: string[];
  travelerPricings: any[]; // Mantener la estructura original
}

export interface EnrichedFlightOffersResponse {
  data: EnrichedFlightOffer[];
  meta: {
    count: number;
    links: {
      self: string;
    };
  };
}
