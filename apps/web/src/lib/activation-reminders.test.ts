import assert from "node:assert/strict";
import test from "node:test";

// Unsubscribe links are signed with the auth secret.
process.env.BETTER_AUTH_SECRET ??= "test-secret-not-real";

import {
  buildActivationReminderEmail,
  daysSinceSignup,
  getReminderDay,
  runActivationReminders,
  type ActivationCandidate,
} from "./activation-reminders";

// Cron runs at 12:00 UTC (09:00 in Sao Paulo).
const cronRun = new Date("2026-11-25T12:00:00Z");

test("reminder days count calendar days in Brazil time, not 24h blocks", () => {
  // 23:30 in Sao Paulo on the 24th is already the 25th in UTC.
  const lateSignup = new Date("2026-11-25T02:30:00Z");
  assert.equal(daysSinceSignup(lateSignup, cronRun), 1);
  assert.equal(getReminderDay(lateSignup, cronRun), 1);
});

test("only day 1 and day 4 after signup get a reminder", () => {
  const signup = (day: string) => new Date(`2026-11-${day}T15:00:00Z`);

  assert.equal(getReminderDay(signup("25"), cronRun), null); // same day
  assert.equal(getReminderDay(signup("24"), cronRun), 1);
  assert.equal(getReminderDay(signup("23"), cronRun), null);
  assert.equal(getReminderDay(signup("21"), cronRun), 4);
  assert.equal(getReminderDay(signup("20"), cronRun), null);
});

test("reminder email reflects the producer's real progress", () => {
  const email = buildActivationReminderEmail(
    { name: "rafael souza", paymentsStarted: true, farmLocated: false },
    4,
    "https://frescari.com.br",
  );

  assert.match(email.subject, /^Rafael, ainda dá tempo/);
  assert.match(email.text, /Oi, Rafael!/);
  assert.match(email.text, /1\. Ativar recebimento \(feito\)/);
  assert.match(email.text, /2\. Marcar a fazenda no mapa \(pendente\)/);
  assert.match(email.text, /https:\/\/frescari\.com\.br\/dashboard/);
});

test("runner emails only producers due today and counts what was sent", async () => {
  const candidates: ActivationCandidate[] = [
    {
      userId: "user_a",
      email: "a@example.com",
      name: "Ana",
      createdAt: new Date("2026-11-24T15:00:00Z"),
      paymentsStarted: false,
      farmLocated: false,
    },
    {
      userId: "user_b",
      email: "b@example.com",
      name: "Bia",
      createdAt: new Date("2026-11-23T15:00:00Z"),
      paymentsStarted: false,
      farmLocated: false,
    },
    {
      userId: "user_c",
      email: "c@example.com",
      name: "Caio",
      createdAt: new Date("2026-11-21T15:00:00Z"),
      paymentsStarted: true,
      farmLocated: true,
    },
  ];
  const sentTo: string[] = [];

  const summary = await runActivationReminders(cronRun, {
    loadCandidates: async () => candidates,
    send: async ({ to }) => {
      sentTo.push(to);
      return to !== "c@example.com";
    },
    appUrl: "https://frescari.com.br",
  });

  assert.deepEqual(sentTo, ["a@example.com", "c@example.com"]);
  assert.deepEqual(summary, { candidates: 3, due: 2, sent: 1 });
});

test("reminders carry an unsubscribe link and one-click headers", async () => {
  const sent: Array<{ text: string; headers?: Record<string, string> }> = [];

  await runActivationReminders(cronRun, {
    loadCandidates: async () => [
      {
        userId: "user_a",
        email: "a@example.com",
        name: "Ana",
        createdAt: new Date("2026-11-24T15:00:00Z"),
        paymentsStarted: false,
        farmLocated: false,
      },
    ],
    send: async ({ text, headers }) => {
      sent.push({ text, headers });
      return true;
    },
    appUrl: "https://frescari.com.br",
  });

  assert.equal(sent.length, 1);
  assert.match(
    sent[0]!.text,
    /Descadastre-se: https:\/\/frescari\.com\.br\/descadastro\?t=/,
  );
  assert.match(
    sent[0]!.headers?.["List-Unsubscribe"] ?? "",
    /^<https:\/\/frescari\.com\.br\/api\/email\/unsubscribe\?t=.+>$/,
  );
  assert.equal(
    sent[0]!.headers?.["List-Unsubscribe-Post"],
    "List-Unsubscribe=One-Click",
  );
});
