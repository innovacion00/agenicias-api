import parsePhoneNumber from 'libphonenumber-js';

export const getCellInfo = (cell: string) => {
  const cellInfo = parsePhoneNumber(cell);

  if (!cellInfo) {
    throw new Error(`Número de teléfono inválido: ${cell}`);
  }

  return {
    country: cellInfo.country || '',
    countryCode: cellInfo.countryCallingCode || '',
    tel: cellInfo.nationalNumber || '',
  };
};
