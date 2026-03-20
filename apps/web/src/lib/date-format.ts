const BRAZIL_LOCALE = "pt-BR";
const SAO_PAULO_TIME_ZONE = "America/Sao_Paulo";
const UTC_TIME_ZONE = "UTC";

type DateValue = Date | string | null | undefined;
type SharedDateFormatOptions = Pick<
  Intl.DateTimeFormatOptions,
  "day" | "month" | "year" | "hour" | "minute"
>;

function normalizeDateValue(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function formatDateInTimeZoneBR(
  value: DateValue,
  options: SharedDateFormatOptions,
  timeZone: string,
) {
  if (!value) {
    return "--";
  }

  return new Intl.DateTimeFormat(BRAZIL_LOCALE, {
    ...options,
    timeZone,
  }).format(normalizeDateValue(value));
}

export function formatSaoPauloDateBR(
  value: DateValue,
  options: SharedDateFormatOptions,
) {
  return formatDateInTimeZoneBR(value, options, SAO_PAULO_TIME_ZONE);
}

export function formatUtcDateBR(
  value: DateValue,
  options: SharedDateFormatOptions,
) {
  return formatDateInTimeZoneBR(value, options, UTC_TIME_ZONE);
}
