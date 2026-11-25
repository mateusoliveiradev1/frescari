import "server-only";

import { authDb, enableRlsBypassContext, users } from "@frescari/db";
import { eq } from "drizzle-orm";

// Reads and writes the reminder/news opt-out for one user. Reached only
// through a signed unsubscribe token, so it runs without a session.

export async function getMarketingPreference(userId: string) {
  return authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);
    const [user] = await tx
      .select({
        email: users.email,
        optedOutAt: users.marketingEmailsOptOutAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return user ?? null;
  });
}

export async function setMarketingOptOut(userId: string, optedOut: boolean) {
  return authDb.transaction(async (tx) => {
    await enableRlsBypassContext(tx);
    const updated = await tx
      .update(users)
      .set({ marketingEmailsOptOutAt: optedOut ? new Date() : null })
      .where(eq(users.id, userId))
      .returning({ id: users.id });
    return updated.length > 0;
  });
}

// "maria.souza@gmail.com" -> "ma***@gmail.com", so the page confirms which
// address without showing it in full to whoever holds the link.
export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "seu e-mail";
  return `${local.slice(0, 2)}***@${domain}`;
}
