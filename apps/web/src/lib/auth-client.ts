"use client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Keep auth calls relative to the current origin so SSR, local dev, and E2E
  // do not drift between localhost and 127.0.0.1.
  basePath: "/api/auth",
});
