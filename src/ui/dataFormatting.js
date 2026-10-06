import { icon } from './icons.js';
export const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
export const formatNumber = (value, digits = 2) => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: digits }) : 'Unavailable';
export function utcTime(value, dateOnly = false) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Unavailable';
  return `<time datetime="${date.toISOString()}">${date.toLocaleString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric', ...(dateOnly ? {} : { hour: '2-digit', minute: '2-digit', hour12: false }) })}${dateOnly ? '' : ' UTC'}</time>`;
}
export function sourceLink(value, title) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    return `<a href="${escape(url.href)}" target="_blank" rel="noopener noreferrer">${escape(title)} ${icon('arrow')}</a>`;
  } catch { return ''; }
}
export function freshness(value) {
  return `<div class="nasa-freshness">${value.stale ? '<span>Saved response. The service could not refresh it.</span>' : ''}<span>Fetched ${utcTime(value.fetchedAt)}</span></div>`;
}
