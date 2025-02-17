import parsePhoneNumber from 'libphonenumber-js';

export const getCellInfo = (cell: string) => {
  const cellInfo = parsePhoneNumber(cell);

  return {
    country: cellInfo.country,
    countryCode: cellInfo.countryCallingCode,
    tel: cellInfo.nationalNumber,
  };
};
