/**
 * Plain calendar dates for tr-calendar and tr-date-picker. A date is an ISO string
 * (yyyy-mm-dd) with no time and no time zone, so it never shifts a day across zones. ISO strings
 * sort as text, so comparisons are string comparisons.
 */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parses yyyy-mm-dd into a local Date at noon (noon keeps DST changes from moving the day). */
export function fromISO(text: string | null | undefined): Date | null {
  const m = ISO.exec((text ?? '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  return d.getMonth() === Number(m[2]) - 1 ? d : null;
}

/** Formats a Date as yyyy-mm-dd (local calendar day). */
export function toISO(d: Date): string {
  const y = d.getFullYear();
  return `${y < 0 ? '-' : ''}${String(Math.abs(y)).padStart(4, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** True when `text` is a real yyyy-mm-dd date. */
export function isISO(text: string | null | undefined): boolean {
  return fromISO(text) !== null;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)!;
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Moves by whole months, keeping the day where the month has it (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso)!;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, daysInMonth(d.getFullYear(), d.getMonth())));
  return toISO(d);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0, 12).getDate();
}

/** yyyy-mm of a date. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

/** First day (yyyy-mm-01) of a yyyy-mm month. */
export function firstOfMonth(month: string): string {
  return `${month}-01`;
}

export function clampISO(iso: string, min?: string, max?: string): string {
  if (min && isISO(min) && iso < min) return min;
  if (max && isISO(max) && iso > max) return max;
  return iso;
}

/** ISO 8601 week number of a date. */
export function isoWeek(iso: string): number {
  const d = fromISO(iso)!;
  const day = (d.getDay() + 6) % 7; // Monday 0
  d.setDate(d.getDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(d.getFullYear(), 0, 4, 12);
  const fd = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - fd + 3);
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 864e5));
}

/** The locale an element speaks: its own `locale`, the nearest lang, the document, the browser. */
export function localeOf(el: Element, own?: string): string {
  if (own) return own;
  const lang = el.closest('[lang]')?.getAttribute('lang') || document.documentElement.lang;
  return lang || (typeof navigator !== 'undefined' ? navigator.language : 'en') || 'en';
}

/** First day of the week for a locale, 0 = Sunday … 6 = Saturday. Monday where the browser cannot say. */
export function weekStartOf(locale: string): number {
  try {
    const loc = new Intl.Locale(locale) as Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };
    const info = loc.getWeekInfo?.() ?? loc.weekInfo;
    if (info?.firstDay) return info.firstDay % 7;
  } catch {
    /* unknown locale */
  }
  return 1;
}

/** A value split into its dates: '2026-11-03' or '2026-11-03/2026-11-09'. */
export function splitRange(value: string): [string, string] {
  const [a = '', b = ''] = (value ?? '').split('/');
  return [isISO(a) ? a : '', isISO(b) ? b : ''];
}

/**
 * Reads a date typed by a person, leniently, in their locale: ISO (2026-11-03), numbers in the
 * locale's order with any separator (03/11/2026, 3.11.26, 11-3-2026 in en-US), and month names or
 * abbreviations in the locale or English (3 Nov 2026, November 3, 2026). A missing year means the
 * current one; a two-digit year means 20xx. Returns yyyy-mm-dd, or null when it is not a date.
 */
export function parseDate(text: string, locale: string, today = todayISO()): string | null {
  const t = text.trim().toLowerCase().replace(/[,]/g, ' ').replace(/\s+/g, ' ');
  if (!t) return null;
  if (isISO(t)) return t;
  const iso = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(t);
  if (iso) return make(+iso[1]!, +iso[2]!, +iso[3]!);
  const thisYear = Number(today.slice(0, 4));
  const year = (y: string | undefined): number => {
    if (!y) return thisYear;
    const n = Number(y);
    return y.length <= 2 ? 2000 + n : n;
  };

  // Month names: the locale's long and short forms, and English as a fallback.
  const names = monthNames(locale);
  const tokens = t.split(/[\s./-]+/).filter(Boolean);
  const monthIdx = tokens.findIndex((tok) => /^\p{L}/u.test(tok));
  if (monthIdx >= 0) {
    const word = tokens[monthIdx]!.replace(/\.$/, '');
    const m = names.findIndex((forms) => forms.some((f) => f === word || (word.length >= 3 && f.startsWith(word))));
    if (m < 0) return null;
    const nums = tokens.filter((_, i) => i !== monthIdx).map((s) => s.replace(/\D/g, '')).filter(Boolean);
    if (nums.length < 1 || nums.length > 2) return null;
    // "2026 Nov 3" (year first) or "3 Nov 2026" / "Nov 3 2026"
    const [a, b] = nums as [string, string | undefined];
    if (a.length === 4) return b ? make(year(a), m + 1, +b) : null;
    return make(year(b), m + 1, +a);
  }

  const nums = tokens.map((s) => s.replace(/\D/g, ''));
  if (nums.length < 2 || nums.length > 3 || nums.some((n) => !n)) return null;
  const order = numericOrder(locale);
  const parts: Record<string, string | undefined> = {};
  if (nums.length === 2) {
    // Day and month only: in the locale's order, leaving the year out.
    const dm = order.filter((p) => p !== 'year');
    parts[dm[0]!] = nums[0];
    parts[dm[1]!] = nums[1];
  } else {
    order.forEach((p, i) => (parts[p] = nums[i]));
  }
  return make(year(parts.year), Number(parts.month), Number(parts.day));

  function make(y: number, m: number, d: number): string | null {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m - 1))) return null;
    return toISO(new Date(y, m - 1, d, 12));
  }
}

const orderCache = new Map<string, Array<'day' | 'month' | 'year'>>();
/** The order of day, month and year in the locale's numeric dates. */
export function numericOrder(locale: string): Array<'day' | 'month' | 'year'> {
  let order = orderCache.get(locale);
  if (!order) {
    try {
      order = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric', year: 'numeric' })
        .formatToParts(new Date(2026, 10, 23, 12))
        .map((p) => p.type)
        .filter((t): t is 'day' | 'month' | 'year' => t === 'day' || t === 'month' || t === 'year');
    } catch {
      order = [];
    }
    if (order.length !== 3) order = ['day', 'month', 'year'];
    orderCache.set(locale, order);
  }
  return order;
}

const nameCache = new Map<string, string[][]>();
function monthNames(locale: string): string[][] {
  let names = nameCache.get(locale);
  if (!names) {
    names = [];
    const forms = (loc: string, month: 'long' | 'short'): string[] => {
      try {
        const f = new Intl.DateTimeFormat(loc, { month });
        return Array.from({ length: 12 }, (_, i) => f.format(new Date(2026, i, 15, 12)).toLowerCase().replace(/\.$/, ''));
      } catch {
        return [];
      }
    };
    const sets = [forms(locale, 'long'), forms(locale, 'short'), forms('en', 'long'), forms('en', 'short')];
    for (let i = 0; i < 12; i++) names.push(sets.map((s) => s[i]).filter((s): s is string => !!s));
    nameCache.set(locale, names);
  }
  return names;
}
