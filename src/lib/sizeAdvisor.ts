import type { Category, SizeProfile } from './types';

/**
 * Suggests a size from height, weight and preferred fit. A simple, honest rule of thumb based on
 * common men's sizing — it gives a starting point, and the size guide / a Telegram question do the rest.
 *
 * Works for: letter sizes (S…3XL), EU suit sizes (44…58) and trouser waist sizes (28…40).
 * Shoes and one-size items get no suggestion.
 */
const LETTERS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
const SUIT_EU = [44, 46, 48, 50, 52, 54, 56, 58]; // XS → 3XL (+ 58 for the biggest)
const WAIST = [28, 30, 32, 34, 36, 38, 40, 42];

type Scheme = 'letter' | 'suit' | 'waist';

export function sizeScheme(category: Pick<Category, 'kind' | 'sizes'>): Scheme | null {
  if (category.kind !== 'APPAREL' || !category.sizes.length) return null;
  const sizes = category.sizes.map((s) => s.toUpperCase());
  if (sizes.every((s) => LETTERS.includes(s) || s === 'XXXL')) return 'letter';
  const nums = sizes.map(Number);
  if (nums.some((n) => Number.isNaN(n))) return null;
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  if (min >= 42 && max <= 62) return 'suit';
  if (min >= 26 && max <= 46) return 'waist';
  return null;
}

/** Body → position on the XS(0)…3XL(6) scale (can be fractional before rounding). */
function bodyIndex(height: number, weight: number, fit: SizeProfile['fit']) {
  // Weight carries most of the signal for chest/waist; height nudges for frame length.
  const byWeight = weight < 52 ? 0 : weight < 60 ? 1 : weight < 70 ? 2 : weight < 80 ? 3 : weight < 92 ? 4 : weight < 104 ? 5 : 6;
  let idx = byWeight;
  if (height >= 190) idx += 1;
  else if (height >= 183 && weight >= 75) idx += 0.5;
  else if (height < 165 && weight < 75) idx -= 0.5;
  if (fit === 'loose') idx += 1;
  if (fit === 'slim') idx -= 0.25;
  return Math.max(0, Math.min(6.9, idx));
}

/** Closest size that this category actually has. */
function nearest(sizes: string[], target: number, toNumber: (s: string) => number) {
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const s of sizes) {
    const d = Math.abs(toNumber(s) - target);
    if (d < bestDiff) {
      best = s;
      bestDiff = d;
    }
  }
  return best;
}

export function suggestSize(category: Pick<Category, 'kind' | 'sizes'>, p: Pick<SizeProfile, 'height' | 'weight' | 'fit'>): string | null {
  if (!p.height || !p.weight) return null;
  const scheme = sizeScheme(category);
  if (!scheme) return null;
  const idx = Math.round(bodyIndex(p.height, p.weight, p.fit));
  if (scheme === 'letter') {
    const letterNum = (s: string) => LETTERS.indexOf(s.toUpperCase() === 'XXXL' ? '3XL' : s.toUpperCase());
    return nearest(category.sizes, idx, letterNum);
  }
  if (scheme === 'suit') return nearest(category.sizes, SUIT_EU[Math.min(idx, SUIT_EU.length - 1)]!, Number);
  return nearest(category.sizes, WAIST[idx]!, Number);
}
