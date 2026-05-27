/** Markup aplicado al total mostrado en disponibilidad MaarLab (porcentaje). */
export const MAARLAB_FLIGHT_AVAILABILITY_MARKUP_PERCENT = 15;

/** Campos de total en ofertas MaarLab (camelCase y PascalCase). */
const OFFER_TOTAL_KEYS = [
  'total',
  'price',
  'totalPrice',
  'TotalPrice',
  'total_price',
  'TotalPriceWithoutLuggage',
  'totalPriceWithoutLuggage',
  'grandTotal',
  'amount',
  'totalAmount',
  'finalPrice',
  'flightPrice',
] as const;

const NESTED_PRICE_KEYS = [
  'total',
  'grandTotal',
  'amount',
  'totalAmount',
  'base',
  'final',
] as const;

function applyMarkupAmount(base: number, markupPercent: number): number {
  const factor = 1 + markupPercent / 100;
  return base * factor;
}

/** Conserva number o string según el tipo original (MaarLab mezcla ambos). */
function formatMarkedUpPrice(
  base: number,
  original: unknown,
  markupPercent: number,
): string | number {
  const marked = applyMarkupAmount(base, markupPercent);

  if (typeof original === 'string') {
    const trimmed = original.trim();
    const dotIndex = trimmed.indexOf('.');
    const decimals = dotIndex >= 0 ? trimmed.length - dotIndex - 1 : 0;
    return marked.toFixed(decimals);
  }

  if (Number.isInteger(base)) {
    return Math.round(marked);
  }

  return Math.round(marked * 100) / 100;
}

function parseNumericPrice(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Precios típicos de una oferta en `searchForFlightsToDestination`. */
const MAARLAB_OFFER_MARKERS = [
  'totalPrice',
  'TotalPrice',
  'TotalPriceWithoutLuggage',
  'totalPriceWithoutLuggage',
] as const;

function hasMaarLabOfferPrice(obj: Record<string, unknown>): boolean {
  return MAARLAB_OFFER_MARKERS.some(
    (key) => parseNumericPrice(obj[key]) !== null,
  );
}

function isMaarLabFlightOffer(obj: Record<string, unknown>): boolean {
  if (typeof obj.flightId === 'string' && obj.flightId.trim() !== '') {
    return true;
  }
  if (hasMaarLabOfferPrice(obj)) {
    return true;
  }
  if (typeof obj.id === 'string' && obj.id.trim() !== '') {
    return OFFER_TOTAL_KEYS.some((key) => parseNumericPrice(obj[key]) !== null);
  }
  return false;
}

/** Ida/vuelta MaarLab: total a nivel par y/o por tramo. */
function isRoundTripPair(obj: Record<string, unknown>): boolean {
  const legKeys = ['outbound', 'inbound', 'outboundFlight', 'inboundFlight'];
  return legKeys.some(
    (key) => obj[key] !== null && typeof obj[key] === 'object',
  );
}

function applyMarkupToPriceFields(
  target: Record<string, unknown>,
  keys: readonly string[],
  markupPercent: number,
): void {
  for (const key of keys) {
    if (!(key in target)) {
      continue;
    }
    const original = target[key];
    const base = parseNumericPrice(original);
    if (base === null) {
      continue;
    }
    target[key] = formatMarkedUpPrice(base, original, markupPercent);
  }
}

function applyMarkupToFlightOffer(
  offer: Record<string, unknown>,
  markupPercent: number,
): void {
  applyMarkupToPriceFields(offer, OFFER_TOTAL_KEYS, markupPercent);

  const priceNode = offer.price;
  if (priceNode && typeof priceNode === 'object' && !Array.isArray(priceNode)) {
    applyMarkupToPriceFields(
      priceNode as Record<string, unknown>,
      NESTED_PRICE_KEYS,
      markupPercent,
    );
  }
}

function walkAndApplyMarkup(node: unknown, markupPercent: number): void {
  if (node == null) {
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) {
      walkAndApplyMarkup(item, markupPercent);
    }
    return;
  }

  if (typeof node !== 'object') {
    return;
  }

  const obj = node as Record<string, unknown>;

  if (isMaarLabFlightOffer(obj)) {
    applyMarkupToFlightOffer(obj, markupPercent);
    return;
  }

  if (isRoundTripPair(obj)) {
    applyMarkupToFlightOffer(obj, markupPercent);
    for (const key of [
      'outbound',
      'inbound',
      'outboundFlight',
      'inboundFlight',
    ]) {
      const leg = obj[key];
      if (leg && typeof leg === 'object' && !Array.isArray(leg)) {
        applyMarkupToFlightOffer(leg as Record<string, unknown>, markupPercent);
      }
    }
    return;
  }

  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object') {
      walkAndApplyMarkup(value, markupPercent);
    }
  }
}

function parseMaarLabAvailabilityPayload(data: unknown): unknown {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) {
      return data;
    }
    return JSON.parse(trimmed);
  }
  return data;
}

/**
 * Aplica markup al total de cada oferta de vuelo en la respuesta de MaarLab
 * (`searchForFlightsToDestination`). No modifica precios de segmentos ni equipaje.
 */
export function applyMaarLabAvailabilityMarkup<T>(
  data: T,
  markupPercent: number = MAARLAB_FLIGHT_AVAILABILITY_MARKUP_PERCENT,
): T {
  if (data == null) {
    return data;
  }

  const parsed = parseMaarLabAvailabilityPayload(data);
  const clone = JSON.parse(JSON.stringify(parsed)) as T;
  walkAndApplyMarkup(clone, markupPercent);

  if (clone && typeof clone === 'object' && !Array.isArray(clone)) {
    (clone as Record<string, unknown>).pricingMarkupPercent = markupPercent;
  }

  return clone;
}

/**
 * Igual que `applyMaarLabAvailabilityMarkup`, pero devuelve JSON string
 * (formato habitual de MaarLab en disponibilidad).
 */
export function applyMaarLabAvailabilityMarkupAsString(
  data: unknown,
  markupPercent: number = MAARLAB_FLIGHT_AVAILABILITY_MARKUP_PERCENT,
): string {
  if (data == null) {
    return '';
  }

  if (typeof data === 'string') {
    const trimmed = data.trim();
    if (!trimmed) {
      return data;
    }
    try {
      const withMarkup = applyMaarLabAvailabilityMarkup(
        JSON.parse(trimmed),
        markupPercent,
      );
      return JSON.stringify(withMarkup);
    } catch {
      return data;
    }
  }

  return JSON.stringify(applyMaarLabAvailabilityMarkup(data, markupPercent));
}
