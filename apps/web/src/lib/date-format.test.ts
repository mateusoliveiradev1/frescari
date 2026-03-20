import test from "node:test";
import assert from "node:assert/strict";

import { formatSaoPauloDateBR, formatUtcDateBR } from "./date-format";

test("formatSaoPauloDateBR uses a fixed timezone for timestamp rendering", () => {
  const isoDate = "2026-03-19T00:30:00.000Z";
  const formattedDate = formatSaoPauloDateBR(isoDate, {
    day: "2-digit",
    month: "2-digit",
  });
  const formattedDateTime = formatSaoPauloDateBR(isoDate, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  assert.equal(formattedDate, "18/03");
  assert.ok(formattedDateTime.includes("18/03"));
  assert.ok(formattedDateTime.includes("21:30"));
});

test("formatUtcDateBR keeps date-only values pinned to the UTC calendar day", () => {
  assert.equal(
    formatUtcDateBR("2026-03-19T00:30:00.000Z", {
      day: "2-digit",
      month: "2-digit",
    }),
    "19/03",
  );
});

test("date formatting helpers return a placeholder for empty values", () => {
  assert.equal(
    formatSaoPauloDateBR(null, {
      day: "2-digit",
      month: "2-digit",
    }),
    "--",
  );
  assert.equal(
    formatUtcDateBR(undefined, {
      day: "2-digit",
      month: "2-digit",
    }),
    "--",
  );
});
