import { getSaleUnitLabel } from "./sale-units";

export function buildProducerStorefrontPath(slug: string): string {
  return `/produtor/${encodeURIComponent(slug)}`;
}

export type StorefrontShareSource = "whatsapp" | "copy" | "native";

// Shared links carry UTM tags so Vercel Analytics can tell how many visits
// each channel brings. The page's canonical URL stays clean, so search
// engines never index the tagged variants.
export function buildStorefrontShareUrl(
  url: string,
  source: StorefrontShareSource,
): string {
  const shareUrl = new URL(url);
  shareUrl.searchParams.set("utm_source", source);
  shareUrl.searchParams.set("utm_medium", "share");
  shareUrl.searchParams.set("utm_campaign", "vitrine");
  return shareUrl.toString();
}

export type StorefrontHighlight = {
  name: string;
  priceLabel: string;
};

type HighlightLot = {
  productName: string;
  finalPrice: number;
  saleUnit: string;
};

// One entry per product (its cheapest lot), in the order the lots came in,
// so the share text and the preview image name what is actually on sale.
export function pickStorefrontHighlights(
  lots: HighlightLot[],
  formatPrice: (value: number) => string,
  max = 4,
): { highlights: StorefrontHighlight[]; productCount: number } {
  const cheapestByProduct = new Map<string, HighlightLot>();

  for (const lot of lots) {
    const current = cheapestByProduct.get(lot.productName);
    if (!current || lot.finalPrice < current.finalPrice) {
      cheapestByProduct.set(lot.productName, lot);
    }
  }

  const highlights = Array.from(cheapestByProduct.values())
    .slice(0, max)
    .map((lot) => ({
      name: lot.productName,
      priceLabel: `${formatPrice(lot.finalPrice)}/${getSaleUnitLabel(lot.saleUnit)}`,
    }));

  return { highlights, productCount: cheapestByProduct.size };
}

// WhatsApp renders *text* as bold. The link goes last, on its own line, so
// WhatsApp builds the preview card from it.
export function buildStorefrontShareText({
  producerName,
  place,
  highlights,
  productCount,
  url,
  fromProducer = false,
}: {
  producerName: string;
  place?: string | null;
  highlights?: StorefrontHighlight[];
  productCount?: number;
  url: string;
  fromProducer?: boolean;
}): string {
  const items = highlights ?? [];
  const lines: string[] = [];

  lines.push(
    fromProducer
      ? `🥬 *${producerName}* agora vende pela Frescari!`
      : `🥬 *${producerName}*${place ? ` · ${place}` : ""}`,
  );

  if (items.length > 0) {
    lines.push("");
    lines.push(
      fromProducer
        ? "Produtos frescos, direto da roça:"
        : "Direto do produtor, fresquinho:",
    );
    for (const item of items) {
      lines.push(`• ${item.name}: ${item.priceLabel}`);
    }
    const remaining = (productCount ?? items.length) - items.length;
    if (remaining > 0) {
      lines.push(
        `…e mais ${remaining} ${remaining === 1 ? "produto" : "produtos"}`,
      );
    }
  }

  lines.push("");
  lines.push(
    fromProducer
      ? "Faça seu pedido pelo link 👇"
      : "Veja tudo e compre direto 👇",
  );
  lines.push(url);

  return lines.join("\n");
}

// wa.me without a phone number opens WhatsApp's contact picker, so the
// sender chooses who gets it (a group, a client list, their status).
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const NAME_CONNECTORS = new Set(["de", "da", "do", "das", "dos", "e"]);

export function getProducerInitials(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/\s+/)
    .filter((word) => /^[a-z0-9]/i.test(word))
    // Skip connectors so "Sitio da Serra" -> "SS".
    .filter((word) => !NAME_CONNECTORS.has(word.toLowerCase()));

  const initials = words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
  return initials || "?";
}

type GroupableLot = {
  categorySlug: string;
  categoryName: string;
};

// Keeps the order the lots came in, for both the groups and the lots in them.
export function groupLotsByCategory<T extends GroupableLot>(
  lots: T[],
): Array<{ slug: string; name: string; lots: T[] }> {
  const groups = new Map<string, { slug: string; name: string; lots: T[] }>();

  for (const lot of lots) {
    const group = groups.get(lot.categorySlug);
    if (group) {
      group.lots.push(lot);
    } else {
      groups.set(lot.categorySlug, {
        slug: lot.categorySlug,
        name: lot.categoryName,
        lots: [lot],
      });
    }
  }

  return Array.from(groups.values());
}
