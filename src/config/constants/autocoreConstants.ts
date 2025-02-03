import { envs } from '../envs';

export const tiposAgencia = {
  mayorista: 'wholesale',
  minorista: 'retailer',
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

export const hotelesAutocore = {
  //? Cartagena
  '13645': 'Hotel Azuan',
  '13633': 'Hotel Aixo',
  '13644': 'Hotel Avexi',
  '13643': 'Hotel Marina',
  '14364': 'Hotel Bocagrande',
  '17644': 'Hotel Abi',
  '13677': 'Hotel Boquilla',

  //? Bogota
  '18004': 'Hotel Windsor',
  '16255': 'Hotel Madisson',

  //? Santa marta
  '17491': 'Hotel Rodadero',
  '15736': 'Hotel 1525',
  '19629': 'Hotel Axis',
  '15740': 'Hotel Sansiraka',
};

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
  'Hotel Rodadero': 9,
  'Hotel 1525': 2,
  'Hotel Axis': 48,
  'Hotel Sansiraka': 44,
};
export const hotelesAutocoreIds = Object.keys(hotelesAutocore);
