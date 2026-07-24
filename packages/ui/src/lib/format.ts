/**
 * The formatters every homelab app rewrites: "3 min ago", "1.4 GB", "2m 08s",
 * "$0.0412". One module, so a queue card in one service and a job row in
 * another round the same way.
 *
 * @summary Shared formatters used across the lab: `relTime`, `fmtDuration`,
 * `fmtBytes`, `fmtNum`, `fmtCost`, `fmtDateTime`, `downloadFile`.
 */

export type TimeInput = string | number | Date;

/** Accepts an ISO string, a Date, epoch ms, or epoch *seconds* (< 1e11). */
function toMs(input: TimeInput): number {
  if (input instanceof Date) return input.getTime();
  if (typeof input === 'number') return input < 1e11 ? input * 1000 : input;
  const parsed = Date.parse(input);
  return Number.isNaN(parsed) ? NaN : parsed;
}

/** `just now` · `4m ago` · `3h ago` · `in 2d` — compact, sign-aware. */
export function relTime(input: TimeInput, now: TimeInput = Date.now()): string {
  const ms = toMs(input);
  if (Number.isNaN(ms)) return '—';

  const diff = toMs(now) - ms;
  const future = diff < 0;
  const s = Math.abs(diff) / 1000;

  const say = (v: string) => (future ? `in ${v}` : `${v} ago`);
  if (s < 45) return 'just now';
  if (s < 3600) return say(`${Math.round(s / 60)}m`);
  if (s < 86_400) return say(`${Math.round(s / 3600)}h`);
  if (s < 604_800) return say(`${Math.round(s / 86_400)}d`);
  if (s < 2_592_000) return say(`${Math.round(s / 604_800)}w`);
  if (s < 31_536_000) return say(`${Math.round(s / 2_592_000)}mo`);
  return say(`${Math.round(s / 31_536_000)}y`);
}

/** `840ms` · `12.4s` · `2m 08s` · `1h 04m` — a duration in ms. */
export function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;

  const total = Math.round(ms / 1000);
  if (total < 60) return `${(ms / 1000).toFixed(1)}s`;

  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

/** `512 B` · `1.4 KB` · `2.3 MB` — SI-ish, one decimal above KB. */
export function fmtBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${Math.round(bytes)} B`;

  const units = ['KB', 'MB', 'GB', 'TB', 'PB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(decimals)} ${units[unit]}`;
}

/** `947` · `12.4k` · `3.1M` — compact counts (tokens, rows, plays). */
export function fmtNum(n: number, decimals = 1): string {
  if (!Number.isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs < 1000) return String(Math.round(n));
  if (abs < 1_000_000) return `${(n / 1000).toFixed(decimals)}k`;
  if (abs < 1_000_000_000) return `${(n / 1_000_000).toFixed(decimals)}M`;
  return `${(n / 1_000_000_000).toFixed(decimals)}B`;
}

/** `$0.0041` · `$1.24` · `$312` — small LLM costs keep their significant digits. */
export function fmtCost(usd: number, currency = '$'): string {
  if (!Number.isFinite(usd)) return '—';
  const abs = Math.abs(usd);
  const digits = abs === 0 ? 2 : abs < 0.01 ? 4 : abs < 100 ? 2 : 0;
  return `${usd < 0 ? '-' : ''}${currency}${abs.toFixed(digits)}`;
}

/** Locale date-time, seconds-free: `12 Jul, 14:03`. */
export function fmtDateTime(input: TimeInput, locale?: string): string {
  const ms = toMs(input);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleString(locale, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Save a string or Blob to the user's disk — the anchor + object-URL dance,
 * with the revoke that hand-rolled copies forget.
 */
export function downloadFile(filename: string, data: Blob | string, mime = 'text/plain') {
  const blob = typeof data === 'string' ? new Blob([data], { type: `${mime};charset=utf-8` }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Give the browser a tick to start the download before dropping the URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
