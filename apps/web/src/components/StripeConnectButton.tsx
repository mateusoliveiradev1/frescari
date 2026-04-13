"use client";

import { Button } from "@frescari/ui";
import { toast } from "sonner";
import { trpc } from "@/trpc/react";
import { useState } from "react";

const stripeStatusStyles: Record<string, string> = {
  blocked: "border-red-200 bg-red-50 text-red-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  ready: "border-emerald-200 bg-emerald-50 text-emerald-700",
  review: "border-sky-200 bg-sky-50 text-sky-700",
};

/**
 * Payment readiness button for producers.
 * The provider stays an implementation detail; visible copy speaks Frescari.
 */
export function StripeConnectButton() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const { data: connectStatus, isLoading: isStatusLoading } =
    trpc.stripe.getConnectStatus.useQuery();

  const { mutate: connectStripe, isPending } =
    trpc.stripe.createStripeConnect.useMutation({
      onSuccess: (data: { url: string }) => {
        setIsRedirecting(true);
        window.location.assign(data.url);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onError: (error: any) => {
        console.error("[STRIPE_CONNECT_ERROR]:", error);
        setIsRedirecting(false);
        toast.error("Erro ao ativar recebimento", {
          description:
            error.message ||
            "Nao foi possivel iniciar a verificacao de recebimento. Tente novamente.",
        });
      },
    });

  const isLoading = isPending || isRedirecting || isStatusLoading;
  const visualState =
    connectStatus?.state === "ready"
      ? "ready"
      : connectStatus?.state === "under_review"
        ? "review"
        : connectStatus?.state === "restricted"
          ? "blocked"
          : "pending";
  const buttonLabel = connectStatus?.actionLabel ?? "Ativar recebimento";

  return (
    <div className="flex flex-col items-end gap-2 max-w-sm">
      {connectStatus ? (
        <div className="space-y-1 text-right">
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] ${stripeStatusStyles[visualState]}`}
          >
            {connectStatus.badgeLabel}
          </span>
          <p className="text-xs font-semibold text-soil">
            {connectStatus.headline}
          </p>
          <p className="text-xs text-bark/80">{connectStatus.description}</p>
        </div>
      ) : null}
      <Button
        className="bg-forest text-cream hover:bg-forest/90 focus-visible:ring-forest normal-case tracking-normal"
        isLoading={isLoading}
        onClick={() => connectStripe({})}
        type="button"
      >
        {buttonLabel}
      </Button>
    </div>
  );
}
