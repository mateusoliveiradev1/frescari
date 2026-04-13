import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveStripeConnectStatus,
  isStripeConnectCatalogEligible,
  isStripeConnectReady,
} from "./stripe-connect-status";

test("marks tenants without account as not started", () => {
  const status = deriveStripeConnectStatus({
    stripeAccountId: null,
    stripeChargesEnabled: null,
    stripePayoutsEnabled: null,
    stripeDetailsSubmitted: null,
    stripeRequirementsCurrentlyDue: null,
    stripeRequirementsEventuallyDue: null,
    stripeRequirementsPastDue: null,
    stripeRequirementsDisabledReason: null,
    stripeStatusSyncedAt: null,
  });

  assert.equal(status.state, "not_started");
  assert.equal(status.canReceivePayments, false);
  assert.equal(isStripeConnectReady(status.snapshot), false);
});

test("marks fully enabled accounts as ready", () => {
  const status = deriveStripeConnectStatus({
    stripeAccountId: "acct_ready",
    stripeChargesEnabled: true,
    stripePayoutsEnabled: true,
    stripeDetailsSubmitted: true,
    stripeRequirementsCurrentlyDue: [],
    stripeRequirementsEventuallyDue: [],
    stripeRequirementsPastDue: [],
    stripeRequirementsDisabledReason: null,
    stripeStatusSyncedAt: new Date("2026-03-22T13:00:00.000Z"),
  });

  assert.equal(status.state, "ready");
  assert.equal(status.canReceivePayments, true);
  assert.equal(status.actionLabel, "Gerenciar recebimento");
  assert.equal(isStripeConnectReady(status.snapshot), true);
});

test("marks accounts with open requirements as pending information", () => {
  const status = deriveStripeConnectStatus({
    stripeAccountId: "acct_pending",
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: false,
    stripeRequirementsCurrentlyDue: ["company.tax_id", "external_account"],
    stripeRequirementsEventuallyDue: [],
    stripeRequirementsPastDue: [],
    stripeRequirementsDisabledReason: null,
    stripeStatusSyncedAt: new Date("2026-03-22T13:00:00.000Z"),
  });

  assert.equal(status.state, "pending_information");
  assert.equal(status.missingFields.length, 2);
  assert.equal(status.canReceivePayments, false);
});

test("marks submitted accounts without current requirements as under review", () => {
  const status = deriveStripeConnectStatus({
    stripeAccountId: "acct_review",
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: true,
    stripeRequirementsCurrentlyDue: [],
    stripeRequirementsEventuallyDue: [],
    stripeRequirementsPastDue: [],
    stripeRequirementsDisabledReason: null,
    stripeStatusSyncedAt: new Date("2026-03-22T13:00:00.000Z"),
  });

  assert.equal(status.state, "under_review");
  assert.equal(status.canReceivePayments, false);
});

test("marks blocked accounts as restricted", () => {
  const status = deriveStripeConnectStatus({
    stripeAccountId: "acct_blocked",
    stripeChargesEnabled: false,
    stripePayoutsEnabled: false,
    stripeDetailsSubmitted: true,
    stripeRequirementsCurrentlyDue: [],
    stripeRequirementsEventuallyDue: [],
    stripeRequirementsPastDue: ["individual.verification.document"],
    stripeRequirementsDisabledReason: "requirements.past_due",
    stripeStatusSyncedAt: new Date("2026-03-22T13:00:00.000Z"),
  });

  assert.equal(status.state, "restricted");
  assert.equal(status.disabledReason, "requirements.past_due");
  assert.equal(status.canReceivePayments, false);
});

test("allows legacy unsynced accounts in catalog until the first status sync runs", () => {
  const snapshot = {
    stripeAccountId: "acct_legacy",
    stripeChargesEnabled: null,
    stripePayoutsEnabled: null,
    stripeDetailsSubmitted: null,
    stripeRequirementsCurrentlyDue: null,
    stripeRequirementsEventuallyDue: null,
    stripeRequirementsPastDue: null,
    stripeRequirementsDisabledReason: null,
    stripeStatusSyncedAt: null,
  };

  assert.equal(isStripeConnectReady(snapshot), false);
  assert.equal(isStripeConnectCatalogEligible(snapshot), true);
});
