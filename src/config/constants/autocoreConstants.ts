import { envs } from '../envs';

export const tiposAgencia = {
  mayorista: 'wholsale',
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

  //? Bogota
  '18004': 'Hotel Windsor',
  '16255': 'Hotel Madisson',

  //? Santa marta
  '17491': 'Hotel Rodadero',
  '15736': 'Hotel 1525',
  '19629': 'Hotel Axis',
  '15740': 'Hotel Sansiraka',
};

export const hotelesAutocoreIds = Object.keys(hotelesAutocore);
