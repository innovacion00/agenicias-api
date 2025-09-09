export interface AmadeusFlightOrderRequest {
  data: {
    type: 'flight-order';
    flightOffers: AmadeusFlightOrderOffer[];
    travelers: AmadeusFlightOrderTraveler[];
    remarks?: {
      general?: Array<{
        subType: string;
        text: string;
      }>;
    };
    ticketingAgreement?: {
      option: 'DELAY_TO_CANCEL';
      delay: string;
    };
    contacts?: AmadeusContact[];
  };
}

export interface AmadeusFlightOrderOffer {
  type?: 'flight-offer';
  id: string;
  source?: string;
  instantTicketingRequired?: boolean;
  nonHomogeneous?: boolean;
  paymentCardRequired?: boolean;
  lastTicketingDate?: string;
  itineraries: AmadeusFlightOrderItinerary[];
  price: AmadeusFlightOrderPrice;
  pricingOptions?: {
    fareType: string[];
    includedCheckedBagsOnly: boolean;
  };
  validatingAirlineCodes?: string[];
  travelerPricings?: AmadeusFlightOrderTravelerPricing[];
}

export interface AmadeusFlightOrderItinerary {
  segments: AmadeusFlightOrderSegment[];
}

export interface AmadeusFlightOrderSegment {
  departure: {
    iataCode: string;
    terminal?: string;
    at: string;
  };
  arrival: {
    iataCode: string;
    terminal?: string;
    at: string;
  };
  carrierCode: string;
  number: string;
  aircraft: {
    code: string;
  };
  operating?: {
    carrierCode?: string;
    carrierName?: string;
  };
  duration: string;
  id: string;
  numberOfStops: number;
}

export interface AmadeusFlightOrderPrice {
  currency: string;
  total: string;
  base: string;
  fees: Array<{
    amount: string;
    type: string;
  }>;
  grandTotal: string;
  billingCurrency?: string;
  additionalServices?: Array<{
    amount: string;
    type: string;
  }>;
}

export interface AmadeusFlightOrderTravelerPricing {
  travelerId: string;
  fareOption: string;
  travelerType: 'ADULT' | 'CHILD' | 'INFANT';
  price: {
    currency: string;
    total: string;
    base: string;
    taxes?: Array<{
      amount: string;
      code: string;
    }>;
  };
  fareDetailsBySegment: Array<{
    segmentId: string;
    cabin: string;
    fareBasis: string;
    brandedFare?: string;
    brandedFareLabel?: string;
    class: string;
    includedCheckedBags: {
      quantity: number;
    };
    includedCabinBags?: {
      quantity: number;
    };
    amenities?: Array<{
      description: string;
      isChargeable: boolean;
      amenityType: string;
      amenityProvider: {
        name: string;
      };
    }>;
  }>;
}

export interface AmadeusFlightOrderTraveler {
  id: string;
  dateOfBirth: string;
  name: {
    firstName: string;
    lastName: string;
  };
  gender: 'MALE' | 'FEMALE';
  contact: {
    emailAddress: string;
    phones: Array<{
      deviceType: 'MOBILE' | 'LANDLINE';
      countryCallingCode: string;
      number: string;
    }>;
  };
  documents?: Array<{
    documentType: 'PASSPORT' | 'ID_CARD';
    birthPlace?: string;
    issuanceLocation?: string;
    issuanceDate?: string;
    number: string;
    expiryDate?: string;
    issuanceCountry?: string;
    validityCountry?: string;
    nationality?: string;
    holder: boolean;
  }>;
}

export interface AmadeusContact {
  addresseeName: {
    firstName: string;
    lastName: string;
  };
  companyName?: string;
  purpose: 'STANDARD' | 'LEISURE' | 'BUSINESS';
  phones: Array<{
    deviceType: 'MOBILE' | 'LANDLINE';
    countryCallingCode: string;
    number: string;
  }>;
  emailAddress: string;
  address: {
    lines: string[];
    postalCode: string;
    cityName: string;
    countryCode: string;
  };
}

export interface AmadeusFlightOrderResponse {
  data: {
    type: 'flight-order';
    id: string;
    flightOffers: AmadeusFlightOrderOffer[];
    travelers: AmadeusFlightOrderTraveler[];
    contacts: AmadeusContact[];
    associatedRecords: Array<{
      reference: string;
      creationDate: string;
      originSystemCode: string;
      flightOfferId: string;
    }>;
    ticketingAgreement: {
      option: string;
      delay: string;
    };
    automatedProcess: Array<{
      code: string;
      queue: {
        number: number;
        category: string;
      };
    }>;
  };
  meta: {
    count: number;
    links: {
      self: string;
    };
  };
}

export interface AmadeusFlightOrderErrorResponse {
  errors: Array<{
    status: number;
    code: number;
    title: string;
    detail: string;
    source?: {
      parameter: string;
      example: string;
    };
  }>;
}
