export function sanitizeEnvValue(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const firstCharacter = trimmed[0];
  const lastCharacter = trimmed[trimmed.length - 1];
  const isWrappedInMatchingQuotes =
    (firstCharacter === '"' || firstCharacter === "'") &&
    firstCharacter === lastCharacter;

  if (!isWrappedInMatchingQuotes) {
    return trimmed;
  }

  const unquoted = trimmed.slice(1, -1).trim();

  return unquoted || undefined;
}
