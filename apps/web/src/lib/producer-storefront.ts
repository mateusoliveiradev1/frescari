export function buildProducerStorefrontPath(slug: string): string {
  return `/produtor/${encodeURIComponent(slug)}`;
}

export function buildStorefrontShareText({
  producerName,
  url,
}: {
  producerName: string;
  url: string;
}): string {
  return `Confira os produtos frescos de ${producerName} na Frescari: ${url}`;
}

// wa.me without a phone number opens WhatsApp's contact picker, so the
// producer chooses who to send it to (a group, a client list, their status).
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
