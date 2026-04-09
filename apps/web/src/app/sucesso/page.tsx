import Link from "next/link";

import { buildNoIndexMetadata } from "@/lib/seo";

import { CartCleaner } from "./cart-cleaner";

export const metadata = buildNoIndexMetadata({
  description:
    "Pagina transacional de confirmacao de pedido da plataforma Frescari.",
  path: "/sucesso",
  title: "Pedido recebido | Frescari",
});

export default function SucessoPage() {
  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-6 py-20">
      <CartCleaner />
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="mx-auto w-20 h-20 rounded-full bg-forest/10 flex items-center justify-center">
          <svg
            className="w-10 h-10 text-forest"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-soil tracking-tight">
            Pedido Recebido!
          </h1>
          <p className="text-bark text-base md:text-lg leading-relaxed max-w-md mx-auto">
            Obrigado por escolher a{" "}
            <span className="font-semibold text-forest">Frescari</span>. Seu
            pedido esta sendo preparado com carinho direto da fazenda.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-forest/10 p-6 shadow-sm space-y-4 text-left">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-forest/10">
                <svg
                  className="w-4 h-4 text-forest"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-soil">
                Pre-autorizacao
              </h3>
              <p className="text-bark text-sm mt-1 leading-relaxed">
                O limite do seu cartao foi{" "}
                <strong className="text-soil">pre-autorizado</strong>. O valor
                final sera cobrado apenas apos a{" "}
                <strong className="text-soil">pesagem exata</strong> dos
                produtos. Voce pode ser cobrado um valor menor que o
                pre-autorizado.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-forest/10">
                <svg
                  className="w-4 h-4 text-forest"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 0 0-10.026 0 1.106 1.106 0 0 0-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </div>
            <div>
              <h3 className="font-sans text-sm font-bold text-soil">
                Proximos passos
              </h3>
              <p className="text-bark text-sm mt-1 leading-relaxed">
                Nossos produtores comecarao a separar seus itens. Voce sera
                notificado quando o pedido estiver a caminho.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <Link
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-forest text-cream font-bold rounded-xl hover:bg-forest/90 transition-all shadow-md hover:shadow-lg hover:-translate-y-[1px] active:translate-y-0"
            href="/dashboard/pedidos"
          >
            Ver Meus Pedidos
          </Link>
          <Link
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-forest/20 text-bark font-semibold rounded-xl hover:bg-forest/5 transition-colors"
            href="/catalogo"
          >
            Continuar Comprando
          </Link>
        </div>

        <p className="text-bark/50 text-xs">
          Duvidas? Fale com nosso suporte via WhatsApp.
        </p>
      </div>
    </main>
  );
}
