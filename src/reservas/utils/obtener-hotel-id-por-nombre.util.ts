import { hotelesAutocore } from 'src/config';

const normalizeHotelName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

export const obtenerHotelIdPorNombre = (
  hotelName: string,
): string | undefined => {
  const normalizedInput = normalizeHotelName(hotelName);

  for (const [hotelId, hotelInfo] of Object.entries(hotelesAutocore)) {
    if (normalizeHotelName(hotelInfo.name) === normalizedInput) {
      return hotelId;
    }
  }

  for (const [hotelId, hotelInfo] of Object.entries(hotelesAutocore)) {
    const normalizedConfig = normalizeHotelName(hotelInfo.name);
    if (
      normalizedInput.includes(normalizedConfig) ||
      normalizedConfig.includes(normalizedInput)
    ) {
      return hotelId;
    }
  }

  return undefined;
};
