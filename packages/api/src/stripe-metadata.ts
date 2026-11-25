// Stripe rejects any metadata value longer than 500 characters, which a cart
// of five items (JSON with lot UUIDs and names) or a long address already
// exceeds. Long values are split across numbered keys and joined back in the
// webhook. Short values keep their plain key, so sessions created before this
// change still read the same way.

export const STRIPE_METADATA_VALUE_LIMIT = 500;

const countKey = (key: string) => `${key}__n`;
const partKey = (key: string, index: number) => `${key}__${index}`;

export function writeChunkedMetadata(
  key: string,
  value: string | null | undefined,
): Record<string, string> {
  if (!value) return {};
  if (value.length <= STRIPE_METADATA_VALUE_LIMIT) return { [key]: value };

  const parts: Record<string, string> = {};
  let count = 0;
  for (
    let start = 0;
    start < value.length;
    start += STRIPE_METADATA_VALUE_LIMIT
  ) {
    parts[partKey(key, count)] = value.slice(
      start,
      start + STRIPE_METADATA_VALUE_LIMIT,
    );
    count += 1;
  }
  parts[countKey(key)] = String(count);
  return parts;
}

export function readChunkedMetadata(
  metadata: Record<string, string> | null | undefined,
  key: string,
): string | undefined {
  if (!metadata) return undefined;
  const plain = metadata[key];
  if (plain) return plain;

  const count = Number(metadata[countKey(key)]);
  if (!Number.isInteger(count) || count <= 0) return undefined;

  let value = "";
  for (let index = 0; index < count; index += 1) {
    const part = metadata[partKey(key, index)];
    if (part === undefined) return undefined;
    value += part;
  }
  return value;
}
