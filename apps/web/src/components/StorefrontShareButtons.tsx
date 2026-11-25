"use client";

import { useState, useSyncExternalStore } from "react";

import {
  buildStorefrontShareText,
  buildStorefrontShareUrl,
  buildWhatsAppShareUrl,
  type StorefrontHighlight,
} from "@/lib/producer-storefront";

const subscribeNoop = () => () => {};
const canUseNativeShare = () =>
  typeof navigator !== "undefined" && typeof navigator.share === "function";

export function StorefrontShareButtons({
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
  // The producer sharing their own page gets first-person wording.
  fromProducer?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  // Server render and first paint assume no native share, so markup matches.
  const nativeShare = useSyncExternalStore(
    subscribeNoop,
    canUseNativeShare,
    () => false,
  );

  const textFor = (shareUrl: string) =>
    buildStorefrontShareText({
      producerName,
      place,
      highlights,
      productCount,
      url: shareUrl,
      fromProducer,
    });

  const whatsAppUrl = buildWhatsAppShareUrl(
    textFor(buildStorefrontShareUrl(url, "whatsapp")),
  );

  async function shareNative() {
    const shareUrl = buildStorefrontShareUrl(url, "native");
    const text = textFor(shareUrl);
    try {
      // The text already ends with the link; passing url too would make some
      // apps paste it twice.
      await navigator.share({ title: producerName, text });
    } catch {
      // The user closed the share sheet: nothing to do.
    }
  }

  async function copyLink() {
    const shareUrl = buildStorefrontShareUrl(url, "copy");
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link da vitrine:", shareUrl);
    }
  }

  return (
    <div className="flex flex-wrap gap-3">
      <a
        href={whatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4 fill-current"
        >
          <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.21-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.4 9.4 0 0 1 6.7 2.78 9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46zm8.06-17.53A11.33 11.33 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.03-1.58a11.37 11.37 0 0 0 5.45 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.18-5.9-3.33-8.05z" />
        </svg>
        Compartilhar no WhatsApp
      </a>
      {nativeShare ? (
        <button
          type="button"
          onClick={shareNative}
          className="inline-flex items-center rounded-full border border-soil/15 bg-white px-4 py-2 text-sm font-semibold text-soil shadow-sm transition-colors hover:text-forest"
        >
          Outros apps
        </button>
      ) : null}
      <button
        type="button"
        onClick={copyLink}
        className="inline-flex items-center rounded-full border border-soil/15 bg-white px-4 py-2 text-sm font-semibold text-soil shadow-sm transition-colors hover:text-forest"
      >
        {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
