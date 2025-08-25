export const AMADEUS_CONSTANTS = {
  ENDPOINTS: {
    LOCATIONS: '/reference-data/locations',
    FLIGHT_OFFERS: '/shopping/flight-offers',
    FLIGHT_ORDERS: '/booking/flight-orders',
  },
  SUB_TYPES: {
    AIRPORT: 'AIRPORT' as const,
    CITY: 'CITY' as const,
    BOTH: 'AIRPORT,CITY' as const,
  },
  VIEW_TYPES: {
    LIGHT: 'LIGHT' as const,
    FULL: 'FULL' as const,
  },
  SORT_TYPES: {
    TRAVELERS_SCORE: 'analytics.travelers.score' as const,
  },
  DEFAULT_PAGE_LIMIT: 10,
  DEFAULT_PAGE_OFFSET: 0,
};
