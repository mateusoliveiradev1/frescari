// Reads where the buyer came back from Stripe Checkout. Checkout sends them to
// /sucesso?session_id=...&farm=<farmId> after paying, or to
// /catalogo?checkout=cancelled&farm=<farmId> when they go back without paying.
// The cart is per farm: only the paid farm's items leave it, and a cancelled
// payment leaves every item where it was.

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function readCheckoutReturn(search: string) {
  const params = new URLSearchParams(search);
  const farm = params.get("farm");

  return {
    farmId: farm && UUID_PATTERN.test(farm) ? farm : null,
    cancelled: params.get("checkout") === "cancelled",
  };
}

/** The same URL without the checkout-return parameters. */
export function stripCheckoutReturnParams(href: string) {
  const url = new URL(href);
  url.searchParams.delete("checkout");
  url.searchParams.delete("farm");
  return `${url.pathname}${url.search}${url.hash}`;
}
