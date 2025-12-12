import { hotelesAutocore } from 'src/config';

export const obtenerCiudadPorNombre = (name: string): string | undefined => {
  for (const key in hotelesAutocore) {
    const hotelInfo = hotelesAutocore[key as keyof typeof hotelesAutocore];
    if (hotelInfo && hotelInfo.name === name) {
      return hotelInfo.city;
    }
  }
  return undefined;
};
