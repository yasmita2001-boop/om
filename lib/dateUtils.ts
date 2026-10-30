export const getLocalDateString = (date: Date = new Date()): string => {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getLocalDateTimeString = (date: Date = new Date()): string => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${getLocalDateString(date)}T${hours}:${minutes}`;
};

export const getLocalMonthString = (date: Date = new Date()): string => {
  return getLocalDateString(date).slice(0, 7);
};
