import {readFileSync} from 'node:fs';
import {model} from './jack-prime.js';

// Reviewed rates are in USD per token. Ordinary chat uses these base rates.
const reviewed = JSON.parse(readFileSync(new URL('./jack-prime-pricing.json',import.meta.url),'utf8'));
export const tokenPriceCeilings = Object.freeze({input:Number(reviewed.pricing.input),output:Number(reviewed.pricing.output)});
const canonical = value => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])) : value;
const reviewedPricing = JSON.stringify(canonical(reviewed.pricing));
const reviewedProviderPricing = JSON.stringify(canonical(reviewed.providerPricing));

export function isApprovedModel(entry) {
  // Pin the entire reviewed pricing schema, including dormant options. Even a
  // lower price or removed fee must be reviewed; JSON object key order may vary.
  return reviewed.model === model && entry?.id === model && entry.type === 'language' && JSON.stringify(canonical(entry.pricing)) === reviewedPricing;
}

export function isApprovedEndpoint(entry) {
  return entry?.provider_name === reviewed.provider && JSON.stringify(canonical(entry.pricing)) === reviewedProviderPricing;
}

export class ModelPricingBlocked extends Error {
  constructor() { super('Jack Prime model pricing differs from its reviewed snapshot.'); }
}

export async function verifyModelPricing(signal) {
  // Check fresh pricing before every generation. Never substitute another model.
  const options = {
    cache:'no-store',
    headers:{'Cache-Control':'no-cache'},
    signal:AbortSignal.any([AbortSignal.timeout(6000), ...signal ? [signal] : []])
  };
  const response = await fetch('https://ai-gateway.vercel.sh/v1/models', options);
  if (!response.ok) throw new Error('Could not verify Jack Prime pricing.');
  const catalog = await response.json();
  if (!Array.isArray(catalog.data) || !isApprovedModel(catalog.data.find(entry => entry.id === model))) throw new ModelPricingBlocked();
  // This model has differently priced providers. Verify the native provider
  // that chat is pinned to, so a cheaper catalog rate cannot mask a surcharge.
  const endpointResponse = await fetch(`https://ai-gateway.vercel.sh/v1/models/${model}/endpoints`, options);
  if (!endpointResponse.ok) throw new Error('Could not verify Jack Prime provider pricing.');
  const endpoints = await endpointResponse.json();
  if (!Array.isArray(endpoints.data?.endpoints) || !isApprovedEndpoint(endpoints.data.endpoints.find(entry => entry.provider_name === reviewed.provider))) throw new ModelPricingBlocked();
}
