export interface AmadeusLocationResponse {
  meta: {
    count: number;
    links: {
      self: string;
    };
  };
  data: AmadeusLocation[];
}

export interface AmadeusLocation {
  type: string;
  subType: 'AIRPORT' | 'CITY';
  name: string;
  detailedName: string;
  id: string;
  self: {
    href: string;
    methods: string[];
  };
  timeZoneOffset: string;
  iataCode: string;
  geoCode: {
    latitude: number;
    longitude: number;
  };
  address: {
    cityName: string;
    cityCode: string;
    countryName: string;
    countryCode: string;
    regionCode: string;
  };
  analytics: {
    travelers: {
      score: number;
    };
  };
}

export interface AmadeusLocationQueryParams {
  subType?: string; // Permitir cualquier string válido para subType
  keyword: string;
  countryCode?: string;
  'page[limit]'?: number;
  'page[offset]'?: number;
  sort?: 'analytics.travelers.score';
  view?: 'LIGHT' | 'FULL';
}

export interface AmadeusErrorResponse {
  errors: AmadeusError[];
}

export interface AmadeusError {
  status: number;
  code: number;
  title: string;
  detail: string;
  source?: {
    parameter: string;
    example: string;
  };
}
