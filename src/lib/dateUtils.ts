/**
 * Centralized date formatting utilities.
 * All dates are displayed in America/Sao_Paulo (UTC-3/UTC-2 DST) timezone,
 * regardless of the user's browser timezone.
 */

const TZ = 'America/Sao_Paulo';

/**
 * Format a date in pt-BR locale with forced America/Sao_Paulo timezone.
 * Accepts any Intl.DateTimeFormatOptions overrides.
 */
export function formatDateBR(
  date: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!date) return '—';
  try {
    return new Date(date).toLocaleString('pt-BR', { timeZone: TZ, ...opts });
  } catch {
    return String(date);
  }
}

/** dd/MM/yyyy, HH:mm */
export function formatDateTimeBR(date: string | Date | null | undefined): string {
  return formatDateBR(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** dd/MM/yyyy, HH:mm:ss */
export function formatDateTimeFullBR(date: string | Date | null | undefined): string {
  return formatDateBR(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** dd/MM, HH:mm */
export function formatShortDateTimeBR(date: string | Date | null | undefined): string {
  return formatDateBR(date, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** dd/MM/yyyy */
export function formatDateOnlyBR(date: string | Date | null | undefined): string {
  return formatDateBR(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Long format: "11 de março de 2026" */
export function formatDateLongBR(date: string | Date | null | undefined): string {
  return formatDateBR(date, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Long format with time: "11 de mar. de 2026 às 15:30" */
export function formatDateTimeLongBR(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    const datePart = d.toLocaleDateString('pt-BR', {
      timeZone: TZ,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('pt-BR', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} às ${timePart}`;
  } catch {
    return String(date);
  }
}

/** Medium format with time: "11 mar 2026 às 15:30" */
export function formatDateTimeMediumBR(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    const d = new Date(date);
    const datePart = d.toLocaleDateString('pt-BR', {
      timeZone: TZ,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timePart = d.toLocaleTimeString('pt-BR', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${datePart} às ${timePart}`;
  } catch {
    return String(date);
  }
}

/**
 * Convert a Date/string to a "fake local" Date shifted to America/Sao_Paulo.
 * Use this when you need date-fns `format()` with BRT timezone.
 * 
 * Example: format(toBRT(someDate), 'dd/MM/yyyy HH:mm', { locale: ptBR })
 */
export function toBRT(date: Date | string): Date {
  const d = new Date(date);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(d);
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0');
  return new Date(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
}
