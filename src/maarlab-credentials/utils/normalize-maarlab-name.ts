/**
 * Normaliza nombres de agencia / hotel MaarLab para comparación estable.
 * Debe usarse igual en sync script y en `MaarlabCredentialsService`.
 */
export function normalizeMaarlabName(
  input: string | null | undefined,
): string {
  if (input == null) return '';
  const trimmed = String(input).trim();
  if (!trimmed) return '';

  return trimmed
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
