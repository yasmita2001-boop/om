// Bikram Sambat (BS) <-> Gregorian (AD) Authoritative Calendar Engine
// Powered by verified Nepali astronomical calendar tables from nepali-date-converter

import NepaliDate from 'nepali-date-converter';

// Resolve default import across ESM/CJS bundlers
const NepaliDateClass: typeof NepaliDate = (NepaliDate as any).default || NepaliDate;

export const OM_BS_MONTHS_NE = [
  'वैशाख', 'जेठ', 'असार', 'श्रावण', 'भाद्र', 'आश्विन',
  'कार्तिक', 'मंसिर', 'पौष', 'माघ', 'फाल्गुन', 'चैत्र'
];

export const OM_BS_MONTHS_EN = [
  'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const OM_BS_DAYS_NE = [
  'आइतबार', 'सोमबार', 'मंगलबार', 'बुधबार', 'बिहीबार', 'शुक्रबार', 'शनिबार'
];

export const OM_BS_DAYS_EN = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const OM_BS_DIGITS = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];

export function omNepaliDigits(v: string | number): string {
  return String(v).replace(/\d/g, d => OM_BS_DIGITS[Number(d)] ?? d);
}

export function omPad(n: number): string {
  return String(n).padStart(2, '0');
}

export function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${omPad(d.getMonth() + 1)}-${omPad(d.getDate())}`;
}

export interface BsDateResult {
  year: number;
  month: number; // 1 - 12
  day: number; // 1 - 32
  dayOfWeek: number; // 0 - 6 (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
  dayNameNe: string;
  dayNameEn: string;
  iso: string; // YYYY-MM-DD
  monthNameNe: string;
  monthNameEn: string;
  formattedNe: string;
  formattedEn: string;
}

export interface AdDateResult {
  year: number;
  month: number;
  day: number;
  dayOfWeek: number;
  dayNameEn: string;
  iso: string;
  formatted: string;
}

/**
 * Accurately convert any Gregorian (AD) date string or Date object to Bikram Sambat (BS).
 * Guarantees exact BS year, month, date, and weekday.
 */
export function adToBs(adIsoOrDate?: string | Date): BsDateResult {
  let jsDate: Date;

  if (!adIsoOrDate) {
    jsDate = new Date();
  } else if (adIsoOrDate instanceof Date) {
    jsDate = adIsoOrDate;
  } else {
    // Parse YYYY-MM-DD
    const parts = adIsoOrDate.split(/[-/]/).map(Number);
    if (parts.length >= 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      // Use midday (12:00:00) to avoid any UTC midnight boundary or daylight savings shifts
      jsDate = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
    } else {
      jsDate = new Date(adIsoOrDate);
    }
  }

  const nepDate = new NepaliDateClass(jsDate);
  const year = nepDate.getYear();
  const month = nepDate.getMonth() + 1; // 1-12
  const day = nepDate.getDate(); // 1-32
  const dayOfWeek = nepDate.getDay(); // 0 (Sunday) to 6 (Saturday)

  const monthIdx = month - 1;
  const monthNameNe = OM_BS_MONTHS_NE[monthIdx] || 'वैशाख';
  const monthNameEn = OM_BS_MONTHS_EN[monthIdx] || 'Baisakh';
  const dayNameNe = OM_BS_DAYS_NE[dayOfWeek] || 'आइतबार';
  const dayNameEn = OM_BS_DAYS_EN[dayOfWeek] || 'Sunday';

  const iso = `${year}-${omPad(month)}-${omPad(day)}`;

  return {
    year,
    month,
    day,
    dayOfWeek,
    dayNameNe,
    dayNameEn,
    iso,
    monthNameNe,
    monthNameEn,
    formattedNe: `${dayNameNe}, ${omNepaliDigits(day)} ${monthNameNe} ${omNepaliDigits(year)}`,
    formattedEn: `${dayNameEn}, ${day} ${monthNameEn} ${year}`
  };
}

/**
 * Accurately convert any Bikram Sambat (BS) date string (YYYY-MM-DD) to Gregorian (AD).
 * Guarantees exact AD year, month, date, and weekday.
 */
export function bsToAd(bsIso: string): AdDateResult {
  const parts = bsIso.split(/[-/]/).map(Number);
  if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
    throw new Error('Invalid BS Date format. Please use YYYY-MM-DD.');
  }

  const targetYear = parts[0];
  const targetMonth = parts[1]; // 1-12
  const targetDay = parts[2]; // 1-32

  const nepDate = new NepaliDateClass(targetYear, targetMonth - 1, targetDay);
  const jsDate = nepDate.toJsDate();

  const year = jsDate.getFullYear();
  const month = jsDate.getMonth() + 1;
  const day = jsDate.getDate();
  const dayOfWeek = jsDate.getDay();
  const dayNameEn = OM_BS_DAYS_EN[dayOfWeek] || 'Sunday';
  const iso = `${year}-${omPad(month)}-${omPad(day)}`;

  return {
    year,
    month,
    day,
    dayOfWeek,
    dayNameEn,
    iso,
    formatted: jsDate.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  };
}

/**
 * Returns the exact number of days in any given BS month (29 - 32 days).
 */
export function getDaysInBsMonth(year: number, month: number): number {
  for (let testDay = 32; testDay >= 29; testDay--) {
    try {
      const nd = new NepaliDateClass(year, month - 1, testDay);
      if (nd.getMonth() === month - 1 && nd.getDate() === testDay) {
        return testDay;
      }
    } catch {}
  }
  return 30;
}

/**
 * Returns the weekday index (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
 * on which the 1st day of the given BS month starts.
 */
export function getBsMonthStartDayOfWeek(year: number, month: number): number {
  try {
    const nd = new NepaliDateClass(year, month - 1, 1);
    return nd.getDay();
  } catch {
    return 0;
  }
}

/**
 * Returns today's exact BS date information.
 */
export function getTodayBs(): BsDateResult {
  return adToBs(new Date());
}

/**
 * Backward compatibility calendar days map proxy.
 */
export const OM_BS_DATA: Record<number, number[]> = new Proxy({}, {
  get: (_, prop) => {
    const yr = Number(prop);
    if (!yr || isNaN(yr)) return undefined;
    return Array.from({ length: 12 }, (_, m) => getDaysInBsMonth(yr, m + 1));
  }
});
