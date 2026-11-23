export const birr = (n: number) => `${n.toLocaleString('en-US')} ETB`;
export const num = (n: number) => n.toLocaleString('en-US');

const LETTER_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL'];

/** Sorts sizes: letters by garment order, numbers numerically. */
export function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = LETTER_ORDER.indexOf(a.toUpperCase());
    const ib = LETTER_ORDER.indexOf(b.toUpperCase());
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    return a.localeCompare(b, 'en', { numeric: true });
  });
}

export function formatDate(iso: string, lang: 'en' | 'am' = 'en') {
  return new Date(iso).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
