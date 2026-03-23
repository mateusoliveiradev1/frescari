import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStripeConnectLegacyAuditReport,
  parseStripeConnectLegacyAuditCliArgs,
  shouldFailStripeConnectLegacyAudit,
} from "./stripe-connect-legacy-audit-cli";

test("parseStripeConnectLegacyAuditCliArgs supports limits, tenant filters and fail mode", () => {
  const args = parseStripeConnectLegacyAuditCliArgs([
    "--limit",
    "15",
    "--tenant-id",
    "tenant-a",
    "--tenant-id=tenant-b",
    "--json",
    "--fail-on-legacy",
  ]);

  assert.deepEqual(args, {
    failOnLegacy: true,
    json: true,
    limit: 15,
    tenantIds: ["tenant-a", "tenant-b"],
  });
});

test("buildStripeConnectLegacyAuditReport summarizes synced, blocked and legacy tenants", () => {
  const report = buildStripeConnectLegacyAuditReport([
    {
      accountId: "acct_ready",
      snapshot: {
        stripeAccountId: "acct_ready",
        stripeChargesEnabled: true,
        stripeDetailsSubmitted: true,
        stripePayoutsEnabled: true,
        stripeRequirementsCurrentlyDue: [],
        stripeRequirementsDisabledReason: null,
        stripeRequirementsEventuallyDue: [],
        stripeRequirementsPastDue: [],
        stripeStatusSyncedAt: new Date("2026-03-22T10:00:00.000Z"),
      },
      tenantId: "tenant-ready",
      tenantName: "Produtor pronto",
    },
    {
      accountId: "acct_legacy",
      snapshot: {
        stripeAccountId: "acct_legacy",
        stripeChargesEnabled: null,
        stripeDetailsSubmitted: null,
        stripePayoutsEnabled: null,
        stripeRequirementsCurrentlyDue: null,
        stripeRequirementsDisabledReason: null,
        stripeRequirementsEventuallyDue: null,
        stripeRequirementsPastDue: null,
        stripeStatusSyncedAt: null,
      },
      tenantId: "tenant-legacy",
      tenantName: "Produtor legado",
    },
    {
      accountId: "acct_blocked",
      snapshot: {
        stripeAccountId: "acct_blocked",
        stripeChargesEnabled: false,
        stripeDetailsSubmitted: true,
        stripePayoutsEnabled: false,
        stripeRequirementsCurrentlyDue: [],
        stripeRequirementsDisabledReason: "requirements.past_due",
        stripeRequirementsEventuallyDue: [],
        stripeRequirementsPastDue: ["company.tax_id"],
        stripeStatusSyncedAt: new Date("2026-03-22T10:00:00.000Z"),
      },
      tenantId: "tenant-blocked",
      tenantName: "Produtor bloqueado",
    },
  ]);

  assert.equal(report.items.length, 3);
  assert.equal(report.summary.total, 3);
  assert.equal(report.summary.legacyUnsynced, 1);
  assert.deepEqual(report.summary.byState, {
    not_started: 0,
    pending_information: 1,
    ready: 1,
    restricted: 1,
    under_review: 0,
  });
});

test("shouldFailStripeConnectLegacyAudit only blocks completion when requested and legacy tenants remain", () => {
  const report = buildStripeConnectLegacyAuditReport([
    {
      accountId: "acct_legacy",
      snapshot: {
        stripeAccountId: "acct_legacy",
        stripeChargesEnabled: null,
        stripeDetailsSubmitted: null,
        stripePayoutsEnabled: null,
        stripeRequirementsCurrentlyDue: null,
        stripeRequirementsDisabledReason: null,
        stripeRequirementsEventuallyDue: null,
        stripeRequirementsPastDue: null,
        stripeStatusSyncedAt: null,
      },
      tenantId: "tenant-legacy",
      tenantName: "Produtor legado",
    },
  ]);

  assert.equal(
    shouldFailStripeConnectLegacyAudit(
      { failOnLegacy: true, json: false, limit: 50, tenantIds: undefined },
      report,
    ),
    true,
  );
  assert.equal(
    shouldFailStripeConnectLegacyAudit(
      { failOnLegacy: false, json: false, limit: 50, tenantIds: undefined },
      report,
    ),
    false,
  );
});
