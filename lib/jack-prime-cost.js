import {model} from './jack-prime.js';

const rateNames = new Set(['input','output','input_cache_read','input_cache_write']);
const zero = value => (typeof value === 'string' && /^0(?:\.0+)?$/.test(value)) || value === 0;

function zeroRates(pricing) {
  if (!pricing || typeof pricing !== 'object' || Array.isArray(pricing)) return false;
  if (!zero(pricing.input) || !zero(pricing.output)) return false;
  return Object.entries(pricing).every(([key,value]) => {
    if (rateNames.has(key)) return zero(value);
    if (key.endsWith('_tiers') && rateNames.has(key.slice(0,-6))) {
      return Array.isArray(value) && value.length > 0 && value.every(tier => tier && zero(tier.cost));
    }
    if (key === 'regional') return value && Object.values(value).every(zeroRates);
    // Unknown charges must be reviewed before this model can be used.
    return false;
  });
}

export function isFreeModel(entry) {
  return entry?.id === model && entry.type === 'language' && zeroRates(entry.pricing);
}

export class PaidModelBlocked extends Error {
  constructor() { super('Jack Prime model pricing is not verified as zero.'); }
}

export async function verifyFreeModel(signal) {
  // Check fresh pricing before every generation. Never fall back to a paid model.
  const response = await fetch('https://ai-gateway.vercel.sh/v1/models', {
    cache:'no-store',
    headers:{'Cache-Control':'no-cache'},
    signal:AbortSignal.any([AbortSignal.timeout(6000), ...signal ? [signal] : []])
  });
  if (!response.ok) throw new Error('Could not verify Jack Prime pricing.');
  const catalog = await response.json();
  if (!Array.isArray(catalog.data) || !isFreeModel(catalog.data.find(entry => entry.id === model))) throw new PaidModelBlocked();
}
