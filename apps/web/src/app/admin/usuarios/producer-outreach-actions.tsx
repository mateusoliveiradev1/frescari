"use client";

import { toast } from "sonner";

import { formatSaoPauloDateBR } from "@/lib/date-format";
import {
  OUTREACH_STAGE_LABELS,
  buildOutreachMessage,
  buildWhatsAppChatUrl,
  getOutreachStage,
  normalizeBrazilianPhone,
} from "@/lib/producer-outreach";
import { trpc } from "@/trpc/react";

// WhatsApp contact for a producer who stopped halfway through setup, plus a
// "contacted" marker so the team does not message the same person twice.
export function ProducerOutreachActions({
  tenantId,
  contactName,
  phone,
  stripeConnected,
  farmCount,
  activeLotCount,
  productCount,
  contactedAt,
}: {
  tenantId: string;
  contactName: string | null;
  phone: string | null;
  stripeConnected: boolean;
  farmCount: number;
  activeLotCount: number;
  productCount: number;
  contactedAt: Date | string | null;
}) {
  const utils = trpc.useUtils();
  const stage = getOutreachStage({
    stripeConnected,
    farmCount,
    activeLotCount,
    productCount,
  });
  const normalizedPhone = normalizeBrazilianPhone(phone);
  const whatsAppUrl = normalizedPhone
    ? buildWhatsAppChatUrl(
        normalizedPhone,
        buildOutreachMessage({ contactName, stage }),
      )
    : null;

  const mark = trpc.admin.setTenantOutreachContacted.useMutation({
    onSuccess: async (_data, variables) => {
      toast.success(
        variables.contacted ? "Marcado como contatado." : "Marcacao removida.",
      );
      await utils.admin.getTenantOperationsOverview.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <div className="mt-5 flex flex-col gap-3 rounded-[20px] border border-forest/10 bg-sage/25 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1">
        <p className="font-sans text-[10px] font-bold uppercase tracking-[0.16em] text-forest">
          Ativacao
        </p>
        <p className="font-sans text-sm font-semibold text-soil">
          {OUTREACH_STAGE_LABELS[stage]}
        </p>
        <p className="font-sans text-xs text-bark/70">
          {contactedAt
            ? `Contatado em ${formatSaoPauloDateBR(contactedAt, {
                day: "2-digit",
                month: "short",
              })}`
            : "Ainda nao contatado"}
          {contactName ? ` · ${contactName}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {whatsAppUrl ? (
          <a
            href={whatsAppUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-[#25D366] px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
          >
            Chamar no WhatsApp
          </a>
        ) : (
          <span className="font-sans text-xs text-bark/60">
            {phone
              ? "Telefone invalido no cadastro"
              : "Sem telefone no cadastro"}
          </span>
        )}
        <button
          type="button"
          disabled={mark.isPending}
          onClick={() => mark.mutate({ tenantId, contacted: !contactedAt })}
          className="rounded-full border border-forest/20 bg-white px-4 py-2 font-sans text-xs font-bold uppercase tracking-[0.12em] text-forest transition-colors hover:bg-forest/5 disabled:opacity-50"
        >
          {contactedAt ? "Desmarcar" : "Marcar contatado"}
        </button>
      </div>
    </div>
  );
}
