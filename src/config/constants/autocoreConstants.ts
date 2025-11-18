import { envs } from '../envs';

export const tiposAgencia = {
  mayorista: 'wholesale',
  minorista: 'retailer',
};

export const agenciaRecargaLimit = {
  minLimitValue: 50000,
  maxLimitValue: 50000000,
};

export const autocoreHeaders = {
  headers: {
    access_key: envs.autocoreAccessKey,
    secret_key: envs.autocoreSecretKey,
  },
};

export const autocoreHeadersDev = {
  headers: {
    access_key: envs.autocoreAccessKeyDev,
    secret_key: envs.autocoreSecretKeyDev,
  },
};

// '15736': { city: 'Santa marta', name: 'Hotel 1525' },
export const hotelesAutocore = {
  //? Cartagena
  '13645': { city: 'Cartagena', name: 'Hotel Azuan' },
  '13633': { city: 'Cartagena', name: 'Hotel Aixo' },
  '13644': { city: 'Cartagena', name: 'Hotel Avexi' },
  '13643': { city: 'Cartagena', name: 'Hotel Marina' },
  '14364': { city: 'Cartagena', name: 'Hotel Bocagrande' },
  '17644': { city: 'Cartagena', name: 'Hotel Abi' },
  '13677': { city: 'Cartagena', name: 'Hotel Boquilla' },

  //? Bogota
  '18004': { city: 'Bogota', name: 'Hotel Windsor' },
  '16255': { city: 'Bogota', name: 'Hotel Madisson' },

  //? Santa marta
  '17491': { city: 'Santa marta', name: 'Hotel Rodadero' },
  '19629': { city: 'Santa marta', name: 'Hotel Axis' },
  '15740': { city: 'Santa marta', name: 'Hotel Sansiraka' },
  '21590':   {city: 'Santa marta', name: 'Playa Salguero Hotel'}
};

// 'Hotel 1525': 2,
export const hotelesAutocorePaymenLink = {
  //? Cartagena
  'Hotel Azuan': 1,
  'Hotel Aixo': 4,
  'Hotel Avexi': 6,
  'Hotel Marina': 9,
  'Hotel Bocagrande': 7,
  'Hotel Abi': 5,
  'Hotel Boquilla': 56,

  //? Bogota
  'Hotel Windsor': 10,
  'Hotel Madisson': 3,

  //? Santa marta
  'Hotel Rodadero': 8,
  'Hotel Axis': 48,
  'Hotel Sansiraka': 44,
  'Playa Salguero Hotel': 123,
};
export const hotelesAutocoreIds = Object.keys(hotelesAutocore);
