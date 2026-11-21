type DateFormat = 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';

let _activeDateFormat: DateFormat = 'DD/MM/YYYY';

export function setActiveDateFormat(fmt: DateFormat | undefined) {
  if (fmt) _activeDateFormat = fmt;
}

/** Format an ISO date string (YYYY-MM-DD) according to the user's chosen date format. */
export function formatDate(isoDate: string): string {
  if (!isoDate) return '';
  const dateOnly = isoDate.slice(0, 10);
  // Only reformat real ISO dates; anything else (already formatted, imported,
  // or malformed) is returned untouched instead of being silently scrambled.
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) return isoDate;
  const [, year, month, day] = match;
  switch (_activeDateFormat) {
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return dateOnly;
    default:            return `${day}/${month}/${year}`;
  }
}

/** Format a Date object (date portion only) using the active format. */
export function formatDateObj(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return formatDate(`${y}-${m}-${d}`);
}
