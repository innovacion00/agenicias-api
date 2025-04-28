import { hotelesAutocore } from 'src/config';

export const obtenerCiudadPorNombre = (name: string): string | undefined => {
  for (const key in hotelesAutocore) {
    if (hotelesAutocore[key].name === name) {
      return hotelesAutocore[key].city;
    }
  }
  return undefined;
};
