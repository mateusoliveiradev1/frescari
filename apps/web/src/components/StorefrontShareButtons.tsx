"use client";

import { useState } from "react";

import {
  buildStorefrontShareText,
  buildWhatsAppShareUrl,
} from "@/lib/producer-storefront";

export function StorefrontShareButtons({
  producerName,
  url,
  shareText,
}: {
  producerName?: string;
  url: string;
  // Overrides the default visitor wording, e.g. the producer sharing their own page.
  shareText?: string;
}) {
  const [copied, setCopied] = useState(false);
  const whatsAppUrl = buildWhatsAppShareUrl(
    shareText ??
      buildStorefrontShareText({
        producerName: producerName ?? "um produtor",
        url,
      }),
  );

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copie o link da vitrine:", url);
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
        Compartilhar no WhatsApp
      </a>
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
