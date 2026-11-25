import {
  authDb,
  enableRlsBypassContext,
  farms,
  productLots,
  tenants,
  users,
} from "@frescari/db";
import { and, eq, gte, isNull, sql } from "drizzle-orm";

import { sendTransactionalEmail } from "@/lib/auth-email";
import { getAppUrl } from "@/lib/app-url";
import {
  buildUnsubscribeFooter,
  buildUnsubscribeHeaders,
  buildUnsubscribePageUrl,
} from "@/lib/email-unsubscribe";

/**
 * Producers who verified their email but never created a lot get two nudges:
 * one the day after signup and one three days later. The stage is derived from
 * the signup date in Brazil time, so a once-a-day cron sends each nudge exactly
 * once without storing any state.
 */
export const REMINDER_DAYS = [1, 4] as const;
export type ReminderDay = (typeof REMINDER_DAYS)[number];

const TIME_ZONE = "America/Sao_Paulo";

function localDateKey(date: Date) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function daysSinceSignup(signupAt: Date, now: Date) {
  const start = Date.parse(`${localDateKey(signupAt)}T00:00:00Z`);
  const today = Date.parse(`${localDateKey(now)}T00:00:00Z`);
  return Math.round((today - start) / 86_400_000);
}

export function getReminderDay(signupAt: Date, now: Date): ReminderDay | null {
  const days = daysSinceSignup(signupAt, now);
  return (REMINDER_DAYS as readonly number[]).includes(days)
    ? (days as ReminderDay)
    : null;
}

export type ActivationCandidate = {
  userId: string;
  email: string;
  name: string;
  createdAt: Date;
  paymentsStarted: boolean;
  farmLocated: boolean;
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function firstName(fullName: string) {
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first
    ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
    : "";
}

export function buildActivationReminderEmail(
  candidate: Pick<
    ActivationCandidate,
    "name" | "paymentsStarted" | "farmLocated"
  >,
  day: ReminderDay,
  appUrl: string,
  unsubscribeUrl?: string,
) {
  const footer = unsubscribeUrl ? buildUnsubscribeFooter(unsubscribeUrl) : null;
  const nome = firstName(candidate.name);
  const greeting = nome ? `Oi, ${nome}!` : "Oi!";
  const ctaUrl = `${appUrl.replace(/\/$/, "")}/dashboard`;
  const subject =
    day === 1
      ? `${nome ? `${nome}, ` : ""}seus primeiros passos na Frescari`
      : `${nome ? `${nome}, ` : ""}ainda dá tempo de publicar seu primeiro lote`;
  const intro =
    day === 1
      ? "Obrigado por criar sua conta de produtor na Frescari. Para os compradores encontrarem seus produtos, faltam poucos passos:"
      : "Vi que você ainda não publicou nenhum lote. Se travou em alguma etapa, me conta respondendo este e-mail. Para relembrar, falta isto:";

  // Same order as the dashboard: quick steps first, the Stripe form last.
  const steps = [
    {
      done: candidate.farmLocated,
      title: "Marcar a fazenda no mapa",
      detail:
        "É o que permite calcular o frete para o comprador. Leva 1 minuto.",
    },
    {
      done: false,
      title: "Publicar o primeiro lote",
      detail:
        "Escolha o produto, a quantidade e o preço. Leva cerca de 1 minuto.",
    },
    {
      done: candidate.paymentsStarted,
      title: "Ativar recebimento",
      detail: candidate.paymentsStarted
        ? "Você já começou. O painel mostra exatamente o que o Stripe ainda pede."
        : "Último passo: cadastro no Stripe para o dinheiro das vendas cair direto na sua conta. Tenha em mãos documento com foto e dados bancários.",
    },
  ];

  const text = [
    greeting,
    "",
    intro,
    "",
    ...steps.map(
      (step, index) =>
        `${index + 1}. ${step.title} ${step.done ? "(feito)" : "(pendente)"}: ${step.detail}`,
    ),
    "",
    `Continuar: ${ctaUrl}`,
    "",
    "Se precisar de ajuda, é só responder este e-mail.",
    "",
    "Mateus Oliveira",
    "Fundador da Frescari",
    ...(footer ? ["", footer.text] : []),
  ].join("\n");

  const stepsHtml = steps
    .map(
      (step, index) => `
        <tr>
          <td valign="top" style="padding:0 12px 14px 0;width:28px;">
            <div style="width:26px;height:26px;line-height:26px;border-radius:13px;text-align:center;font-size:13px;font-weight:bold;${
              step.done
                ? "background:#0d3321;color:#f9f6f0;"
                : "background:#efe9de;color:#2b2118;"
            }">${step.done ? "&#10003;" : index + 1}</div>
          </td>
          <td valign="top" style="padding:0 0 14px;font-size:15px;line-height:1.5;">
            <strong style="color:#0d3321;">${escapeHtml(step.title)}</strong>${
              step.done
                ? ' <span style="font-size:12px;color:#0d3321;">feito</span>'
                : ""
            }<br><span style="color:#5d5248;">${escapeHtml(step.detail)}</span>
          </td>
        </tr>`,
    )
    .join("");

  const html = `
    <div style="background:#f9f6f0;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#2b2118;">
      <div style="margin:0 auto;max-width:560px;background:#ffffff;border:1px solid #e8e1d4;border-radius:12px;padding:28px;">
        <p style="margin:0 0 16px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#0d3321;font-weight:bold;">Frescari</p>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">${escapeHtml(greeting)}</p>
        <p style="margin:0 0 18px;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>
        <div style="background:#f9f6f0;border-radius:10px;padding:18px 18px 4px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">${stepsHtml}</table>
        </div>
        <p style="margin:24px 0;text-align:center;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0d3321;color:#f9f6f0;text-decoration:none;font-weight:bold;font-size:16px;padding:14px 26px;border-radius:8px;">Continuar de onde parei</a>
        </p>
        <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Se precisar de ajuda, é só <strong>responder este e-mail</strong>.</p>
        <p style="margin:0;font-size:16px;line-height:1.6;">Mateus Oliveira<br><span style="color:#5d5248;">Fundador da Frescari</span></p>
        ${footer ? footer.html : ""}
      </div>
    </div>
  `.trim();

  return { subject, text, html };
}

async function loadActivationCandidates(
  now: Date,
): Promise<ActivationCandidate[]> {
  // Look a little past the last reminder day so timezone edges are covered;
  // getReminderDay does the exact selection.
  const since = new Date(now.getTime() - 7 * 86_400_000);

  return authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);

    return tx
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        createdAt: users.createdAt,
        paymentsStarted: sql<boolean>`${tenants.stripeAccountId} is not null`,
        farmLocated: sql<boolean>`exists (select 1 from ${farms} where ${farms.tenantId} = ${tenants.id} and ${farms.location} is not null)`,
      })
      .from(users)
      .innerJoin(tenants, eq(tenants.id, users.tenantId))
      .where(
        and(
          eq(users.role, "producer"),
          eq(users.emailVerified, true),
          // Unsubscribed people get no reminders.
          isNull(users.marketingEmailsOptOutAt),
          gte(users.createdAt, since),
          sql`not exists (select 1 from ${productLots} where ${productLots.tenantId} = ${tenants.id})`,
        ),
      );
  });
}

export type ActivationReminderSummary = {
  candidates: number;
  due: number;
  sent: number;
};

export async function runActivationReminders(
  now = new Date(),
  deps: {
    loadCandidates?: (now: Date) => Promise<ActivationCandidate[]>;
    send?: typeof sendTransactionalEmail;
    appUrl?: string;
  } = {},
): Promise<ActivationReminderSummary> {
  const candidates = await (deps.loadCandidates ?? loadActivationCandidates)(
    now,
  );
  const send = deps.send ?? sendTransactionalEmail;
  const appUrl = deps.appUrl ?? getAppUrl();

  let due = 0;
  let sent = 0;

  for (const candidate of candidates) {
    const day = getReminderDay(candidate.createdAt, now);
    if (!day) {
      continue;
    }

    due += 1;
    const email = buildActivationReminderEmail(
      candidate,
      day,
      appUrl,
      buildUnsubscribePageUrl(appUrl, candidate.userId),
    );
    const ok = await send({
      to: candidate.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
      logLabel: `activation reminder day ${day}`,
      headers: buildUnsubscribeHeaders(appUrl, candidate.userId),
    });
    if (ok) {
      sent += 1;
    }
  }

  return { candidates: candidates.length, due, sent };
}
