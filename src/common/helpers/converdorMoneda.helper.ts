export const convertidorMoneda = (monto: number) => {
  const format = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0, // Evitar decimales innecesarios
  });
  return format.format(monto)
};
