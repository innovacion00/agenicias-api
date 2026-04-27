/**
 * Alinea nombres de MaarLab (`hotel_name`) con `Agencia.fullName` (booking).
 * Quita acentos, minúsculas, recorta y colapsa espacios.
 */
export function normalizeMaarlabAgencyName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
