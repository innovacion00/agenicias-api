import { envs } from '../envs';

export interface MyToolHotelConfig {
  ip: string;
  autocoreId: string | null;
  name: string;
  city: string;
}

export const hotelMyToolConfig: Record<string, MyToolHotelConfig> = {
  aixo: {
    ip: envs.apiAixo,
    autocoreId: '13633',
    name: 'Hotel Aixo',
    city: 'Cartagena',
  },
  azuan: {
    ip: envs.apiAzuan,
    autocoreId: '13645',
    name: 'Hotel Azuan',
    city: 'Cartagena',
  },
  avexi: {
    ip: envs.apiAvexi,
    autocoreId: '13644',
    name: 'Hotel Avexi',
    city: 'Cartagena',
  },
  marina: {
    ip: envs.apiMarina,
    autocoreId: '13643',
    name: 'Hotel Marina',
    city: 'Cartagena',
  },
  bocagrande: {
    ip: envs.apiBocagrande,
    autocoreId: '14364',
    name: 'Hotel Bocagrande',
    city: 'Cartagena',
  },
  abi: {
    ip: envs.apiAbi,
    autocoreId: '17644',
    name: 'Hotel Abi',
    city: 'Cartagena',
  },
  boquilla: {
    ip: envs.apiAvexi,
    autocoreId: '13677',
    name: 'Hotel Boquilla',
    city: 'Cartagena',
  },
  madisson: {
    ip: envs.apiMadisson,
    autocoreId: '16255',
    name: 'Hotel Madisson',
    city: 'Bogota',
  },
  windsor: {
    ip: envs.apiWindsor,
    autocoreId: '18004',
    name: 'Hotel Windsor',
    city: 'Bogota',
  },
  rodadero: {
    ip: envs.apiRodadero,
    autocoreId: '17491',
    name: 'Hotel Rodadero',
    city: 'Santa marta',
  },
  axis: {
    ip: envs.apiAxis,
    autocoreId: '19629',
    name: 'Hotel Axis',
    city: 'Santa marta',
  },
  marques: {
    ip: envs.apiMarques,
    autocoreId: null,
    name: 'Hotel El Marques',
    city: 'Cartagena',
  },
  sansiraka: {
    ip: envs.apiSansiraka,
    autocoreId: '15740',
    name: 'Hotel Sansiraka',
    city: 'Santa marta',
  },
  playasalguero: {
    ip: envs.apiPlayaSalguero,
    autocoreId: '21590',
    name: 'Playa Salguero Hotel',
    city: 'Santa marta',
  },
};

export const hotelMyToolSlugs = Object.keys(hotelMyToolConfig);

export const MY_TOOL_CANAL_VENTA_ID = 41;
export const MY_TOOL_MAQUINA_ID = 1;
export const MY_TOOL_ESTADO_CUENTA_PATH = 'EstadoCuenta/GetEstadoCuentaReserva';
