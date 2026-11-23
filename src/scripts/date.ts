/**
 * Format an input date into the Japanese long date format (ja-JP).
 *
 * Accepts a string, number, or Date and returns a localized date string; null, undefined,
 * or an empty/whitespace-only string are treated as invalid.
 *
 * Formats in UTC because date-only strings such as frontmatter `2026-03-02` parse as UTC
 * midnight; using the build machine's time zone would shift the day west of UTC.
 *
 * @param dateInput - The value to format; passed to the Date constructor for parsing.
 * @returns The date formatted in ja-JP long form (e.g., "2026年3月2日") if valid, `false` otherwise.
 */
export function formatDate(
  dateInput: string | number | Date | null | undefined,
): string | false {
  if (
    dateInput === null ||
    dateInput === undefined ||
    (typeof dateInput === 'string' && dateInput.trim() === '')
  ) {
    return false;
  }

  const date = new Date(dateInput);

  if (isValidDate(date)) {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } else {
    return false;
  }
}

/**
 * Determines whether a Date object represents a valid calendar date.
 *
 * @param date - The Date object to validate
 * @returns `true` if `date` represents a valid date, `false` otherwise
 */
function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}
