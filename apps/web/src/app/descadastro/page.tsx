import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";

import { verifyUnsubscribeToken } from "@/lib/email-unsubscribe";
import {
  getMarketingPreference,
  maskEmail,
  setMarketingOptOut,
} from "@/lib/email-preferences";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Preferencias de e-mail | Frescari",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ t?: string }>;
};

async function updatePreference(formData: FormData) {
  "use server";
  const token = String(formData.get("t") ?? "");
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return;
  await setMarketingOptOut(userId, formData.get("action") === "unsubscribe");
  revalidatePath("/descadastro");
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-cream px-6 py-16">
      <div className="w-full max-w-md space-y-5 rounded-[28px] border border-soil/10 bg-white p-8 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest">
          Preferencias de e-mail
        </p>
        {children}
      </div>
    </main>
  );
}

export default async function UnsubscribePage({ searchParams }: PageProps) {
  const { t: token = "" } = await searchParams;
  const userId = verifyUnsubscribeToken(token);
  const preference = userId ? await getMarketingPreference(userId) : null;

  if (!userId || !preference) {
    return (
      <Shell>
        <h1 className="font-display text-3xl font-black text-soil">
          Link invalido
        </h1>
        <p className="text-bark">
          Este link de descadastro nao e valido. Use o link do e-mail mais
          recente ou fale com a gente em suporte@frescari.com.br.
        </p>
        <Link href="/" className="inline-block font-semibold text-forest">
          Ir para a Frescari →
        </Link>
      </Shell>
    );
  }

  const optedOut = preference.optedOutAt !== null;
  const email = maskEmail(preference.email);

  return (
    <Shell>
      <h1 className="font-display text-3xl font-black text-soil">
        {optedOut ? "Pronto, descadastrado" : "Parar de receber lembretes?"}
      </h1>
      <p className="text-bark">
        {optedOut
          ? `${email} nao recebe mais lembretes e novidades da Frescari.`
          : `${email} deixa de receber lembretes e novidades da Frescari.`}
      </p>
      <p className="text-sm text-bark/80">
        E-mails da sua conta continuam chegando: confirmacao de cadastro,
        pedidos e avisos de pagamento.
      </p>
      <form action={updatePreference}>
        <input type="hidden" name="t" value={token} />
        <input
          type="hidden"
          name="action"
          value={optedOut ? "resubscribe" : "unsubscribe"}
        />
        <button
          type="submit"
          className={
            optedOut
              ? "w-full rounded-sm border border-forest px-4 py-3 text-sm font-bold uppercase tracking-wider text-forest hover:bg-forest/5"
              : "w-full rounded-sm bg-forest px-4 py-3 text-sm font-bold uppercase tracking-wider text-cream hover:bg-forest/90"
          }
        >
          {optedOut ? "Voltar a receber" : "Sim, descadastrar"}
        </button>
      </form>
    </Shell>
  );
}
