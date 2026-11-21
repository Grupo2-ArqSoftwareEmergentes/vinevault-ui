/** Legacy Core DateTime columns contain naive UTC, never browser-local time. */
export function deviceUtcTimestamp(value: string | null | undefined): string | null {
  if (!value) return null;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value) ? value + 'Z' : value;
}
