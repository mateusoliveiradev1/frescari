import Link from "next/link";

import {
  getCheckoutConfirmation,
  type CheckoutConfirmation,
} from "@/lib/checkout-confirmation";
import { buildNoIndexMetadata } from "@/lib/seo";

import { CartCleaner } from "./cart-cleaner";

export const metadata = buildNoIndexMetadata({
  description:
    "Pagina transacional de confirmacao de pedido da plataforma Frescari.",
  path: "/sucesso",
  title: "Seu pedido | Frescari",
});

// Each visit asks Stripe for the payment's real state.
export const dynamic = "force-dynamic";

type Content = {
  title: string;
  lead: string;
  tone: "success" | "waiting" | "neutral";
  notes: Array<{ title: string; text: string }>;
};

const NEXT_STEPS = {
  title: "Proximos passos",
  text: "O produtor vai separar seus itens. Voce recebe um aviso quando o pedido sair para entrega.",
};

const CONTENT: Record<CheckoutConfirmation, Content> = {
  paid: {
    title: "Pedido recebido!",
    lead: "Pagamento confirmado. Seu pedido ja foi enviado ao produtor.",
    tone: "success",
    notes: [NEXT_STEPS],
  },
  authorized: {
    title: "Pedido recebido!",
    lead: "Seu pedido ja foi enviado ao produtor.",
    tone: "success",
    notes: [
      {
        title: "Pre-autorizacao",
        text: "O valor foi reservado no seu cartao, sem cobranca ainda. O valor final e cobrado so depois da pesagem dos produtos e pode ser menor que o reservado.",
      },
      NEXT_STEPS,
    ],
  },
  pix_pending: {
    title: "Aguardando o pagamento do Pix",
    lead: "Se voce ja pagou, a confirmacao chega em instantes. O pedido aparece em Meus Pedidos assim que o Pix for confirmado.",
    tone: "waiting",
    notes: [
      {
        title: "Ainda nao pagou?",
        text: "O QR code do Pix vale 30 minutos. Depois disso, nada e cobrado e seus itens continuam no carrinho.",
      },
    ],
  },
  not_paid: {
    title: "Pagamento nao concluido",
    lead: "Nada foi cobrado. Seus itens continuam no carrinho.",
    tone: "neutral",
    notes: [],
  },
  unknown: {
    title: "Confira o seu pedido",
    lead: "Nao conseguimos confirmar este pagamento agora. Se a compra foi concluida, ela aparece em Meus Pedidos em alguns instantes.",
    tone: "neutral",
    notes: [],
  },
};

const TONE_STYLES: Record<Content["tone"], string> = {
  success: "bg-forest/10 text-forest",
  waiting: "bg-amber-100 text-amber-700",
  neutral: "bg-soil/10 text-soil",
};

function StatusIcon({ tone }: { tone: Content["tone"] }) {
  const path =
    tone === "success"
      ? "M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      : tone === "waiting"
        ? "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        : "M11.25 11.25l.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z";
  return (
    <svg
      aria-hidden="true"
      className="w-10 h-10"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default async function SucessoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const sessionId =
    typeof params.session_id === "string" ? params.session_id : null;
  const confirmation = await getCheckoutConfirmation(sessionId);
  const content = CONTENT[confirmation];
  // Only a confirmed or held payment takes the farm's items out of the cart:
  // a Pix still pending can expire, and then the buyer wants them back.
  const clearCart = confirmation === "paid" || confirmation === "authorized";

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-6 py-20">
      <CartCleaner clear={clearCart} />
      <div className="max-w-lg w-full text-center space-y-8">
        <div
          className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${TONE_STYLES[content.tone]}`}
        >
          <StatusIcon tone={content.tone} />
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-soil tracking-tight">
            {content.title}
          </h1>
          <p className="text-bark text-base md:text-lg leading-relaxed max-w-md mx-auto">
            {content.lead}
          </p>
        </div>

        {content.notes.length > 0 ? (
          <div className="bg-white rounded-2xl border border-forest/10 p-6 shadow-sm space-y-4 text-left">
            {content.notes.map((note) => (
              <div key={note.title}>
                <h2 className="font-sans text-sm font-bold text-soil">
                  {note.title}
                </h2>
                <p className="text-bark text-sm mt-1 leading-relaxed">
                  {note.text}
                </p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          {confirmation === "not_paid" ? (
            <Link
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-forest text-cream font-bold rounded-xl hover:bg-forest/90 transition-all shadow-md"
              href="/catalogo"
            >
              Voltar ao catalogo
            </Link>
          ) : (
            <Link
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-forest text-cream font-bold rounded-xl hover:bg-forest/90 transition-all shadow-md hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0"
              href="/dashboard/pedidos"
            >
              Ver Meus Pedidos
            </Link>
          )}
          {confirmation === "pix_pending" && sessionId ? (
            <Link
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-forest/20 text-bark font-semibold rounded-xl hover:bg-forest/5 transition-colors"
              href={`/sucesso?session_id=${encodeURIComponent(sessionId)}${
                typeof params.farm === "string"
                  ? `&farm=${encodeURIComponent(params.farm)}`
                  : ""
              }`}
            >
              Ja paguei, atualizar
            </Link>
          ) : (
            <Link
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-forest/20 text-bark font-semibold rounded-xl hover:bg-forest/5 transition-colors"
              href="/catalogo"
            >
              Continuar Comprando
            </Link>
          )}
        </div>

        <p className="text-bark/50 text-xs">
          Duvidas? Fale com nosso suporte via WhatsApp.
        </p>
      </div>
    </main>
  );
}
