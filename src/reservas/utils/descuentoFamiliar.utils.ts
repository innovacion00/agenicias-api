import { Iavailability } from 'src/common/interface';

export const descuentoFamiliar = (
  disponibilidades: Iavailability[],
  nights: number,
) => {
  for (const disponibilidad of disponibilidades) {
    if (
      disponibilidad.hotel.roomcloud_id === '13645' ||
      disponibilidad.hotel.roomcloud_id === '13644' ||
      disponibilidad.hotel.roomcloud_id === '13643' ||
      disponibilidad.hotel.roomcloud_id === '13633'
    ) {
      for (const availability of disponibilidad.availability) {
        const childrenCount = availability.children_ages
          ? availability.children_ages.split(',').length
          : 0;

        if (availability.adults + childrenCount === 3) {
          for (const rooms of availability.available_rooms) {
            for (const product of rooms.products) {
              product.baseRate.amountBeforeTax =
                product.baseRate.amountBeforeTax - 50000 * nights;
              product.baseRate.amountAfterTax =
                product.baseRate.amountBeforeTax * 0.19 +
                product.baseRate.amountBeforeTax;
            }
          }
        }
      }
    }
  }

  return disponibilidades;
};
