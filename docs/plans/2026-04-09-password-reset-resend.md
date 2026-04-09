# Password Reset via Resend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a secure "forgot password" flow that sends reset emails through Resend, lets the user define a new password in the web app, and fits the existing Better Auth + Next.js architecture without changing the database schema.

**Architecture:** The flow starts on a dedicated `/auth/forgot-password` page that calls Better Auth `requestPasswordReset` with a redirect to `/auth/reset-password`. Better Auth keeps token issuance in the existing `verification` table, while the project stays responsible for the reset email body through the existing Resend integration in `apps/web/src/lib/auth-email.ts`. The reset page consumes Better Auth query params (`token` and optional `error`), reuses the existing password policy from `apps/web/src/lib/password-policy.ts`, and finishes with `authClient.resetPassword`.

**Tech Stack:** Next.js 16 App Router, React 19, Better Auth 1.6.1, Drizzle adapter, direct Resend REST API via `fetch`, Node.js built-in test runner with JSDOM, Playwright.

---

## Project Context to Preserve

- Auth lives in `apps/web/src/lib/auth.ts` and already uses `betterAuth(...)` with:
  - `emailAndPassword.enabled = true`
  - `requireEmailVerification = true`
  - existing email verification via `sendAuthVerificationEmail(...)`
- Transactional auth email delivery already exists in `apps/web/src/lib/auth-email.ts` and `apps/web/src/lib/auth-email.test.ts`.
- Password strength rules already exist in `apps/web/src/lib/password-policy.ts`.
- The login form exists at `apps/web/src/app/auth/login/login-form.tsx`, but there is no "forgot password" entry point yet.
- The polished UX reference for auth email follow-up states is `apps/web/src/app/auth/verify-email/verify-email-client.tsx`.
- Route-level auth hardening lives in `apps/web/src/app/api/auth/[...all]/route.ts`.
- The architecture doc already mentions password reset rate limiting, but it is stale: it still references `"/forget-password"` while the Better Auth docs for the current library version describe `requestPasswordReset`.
- No database migration is expected. Better Auth should continue using the existing `verification` table in `packages/db/src/schema.ts`.

## Assumptions / Decisions

- Keep the current project pattern of using the Resend HTTP API directly via `fetch`; do not introduce the Resend SDK.
- Use generic success copy on the request screen to avoid email enumeration.
- Keep the reset token lifetime at **1 hour** (`60 * 60`) to match the Better Auth default unless product later asks for a shorter TTL.
- Set `revokeSessionsOnPasswordReset: true` for better security after a credential reset.
- Do **not** auto-sign-in after a successful reset. Show a success state with a CTA back to `/auth/login`.
- If a user resets the password but the email is still unverified, the existing sign-in flow should continue to route them through email verification.
- Until runtime behavior is confirmed, keep both `"/request-password-reset"` and `"/forget-password"` protected by route-level rate limiting so the wrapper remains safe during the migration.

## Relevant Skills During Execution

- `@subagent-driven-development` for fresh worker-per-task execution in this session
- `@test-driven-development` for every implementation slice below
- `@verification-before-completion` before claiming the feature is ready

---

## Atomic Execution Order

> **Execution rule:** each slice below has a single responsibility. Do not start the next slice until the current slice has fresh passing verification evidence.

### Slice 1: Protect the real request-password-reset endpoint

- Scope: only `apps/web/src/app/api/auth/[...all]/route.ts` and `apps/web/src/app/api/auth/[...all]/route.test.ts`
- Goal: prove `POST /api/auth/request-password-reset` is rate limited after 10 attempts from the same IP
- Do not touch: auth config, email helpers, UI, docs
- Done when: the focused route test passes and `RATE_LIMITED_PATHS` includes `"/request-password-reset"`

### Slice 2: Preserve legacy route wrapper compatibility

- Scope: only `apps/web/src/app/api/auth/[...all]/route.ts` and `apps/web/src/app/api/auth/[...all]/route.test.ts`
- Goal: keep `"/forget-password"` protected too while the wrapper transitions to the current Better Auth path
- Do not touch: UI or auth server config
- Done when: compatibility coverage is explicit in code or test comments and no regression is introduced for the legacy path

### Slice 3: Introduce password reset path constants and redirect builder

- Scope: only `apps/web/src/lib/password-reset.ts` and `apps/web/src/lib/password-reset.test.ts`
- Goal: centralize `FORGOT_PASSWORD_PATH`, `RESET_PASSWORD_PATH`, and `buildResetPasswordRedirectUrl(...)`
- Do not touch: auth email delivery, page components
- Done when: the helper test passes for URL joining and path constants are the single source of truth

### Slice 4: Normalize reset page query-state parsing

- Scope: only `apps/web/src/lib/password-reset.ts` and `apps/web/src/lib/password-reset.test.ts`
- Goal: safely parse `token` and supported `error` values from `URLSearchParams`
- Do not touch: form rendering or API calls
- Done when: parsing tests pass for valid token, missing token, and `INVALID_TOKEN`

### Slice 5: Add the reset email template builder

- Scope: only `apps/web/src/lib/auth-email.ts` and `apps/web/src/lib/auth-email.test.ts`
- Goal: add `buildAuthPasswordResetEmail(...)` with correct subject, CTA, fallback copy, and plain-text content
- Do not touch: Better Auth config or page components
- Done when: template-only tests pass and the copy clearly communicates reset intent without exposing internals

### Slice 6: Add the reset email sender transport path

- Scope: only `apps/web/src/lib/auth-email.ts` and `apps/web/src/lib/auth-email.test.ts`
- Goal: add `sendAuthPasswordResetEmail(...)` using the existing Resend transport and the same local/prod fallback rules as verification email
- Do not touch: auth.ts, UI, docs
- Done when: the sender test passes for dev fallback, prod missing-config failure, and successful POST payload

### Slice 7: Extract a pure Better Auth password configuration factory

- Scope: only `apps/web/src/lib/auth-password.ts` and `apps/web/src/lib/auth-password.test.ts`
- Goal: isolate email-and-password config for reset-password behavior, TTL, and session revocation
- Do not touch: `apps/web/src/lib/auth.ts` yet
- Done when: the factory test passes for `requireEmailVerification`, `resetPasswordTokenExpiresIn`, `revokeSessionsOnPasswordReset`, and `sendResetPassword`

### Slice 8: Wire the new password config into Better Auth

- Scope: only `apps/web/src/lib/auth.ts`
- Goal: replace the inline `emailAndPassword` object with the extracted factory while preserving existing verification-email behavior
- Do not touch: route wrapper, UI, docs
- Done when: auth bootstraps with the new factory and verification wiring remains unchanged in diff

### Slice 9: Add the login entry point to forgot-password

- Scope: only `apps/web/src/app/auth/login/login-form.tsx`
- Goal: give the user a clear `Esqueci minha senha` navigation path from login
- Do not touch: forgot-password form internals yet
- Done when: the link is visible, accessible, and points to `/auth/forgot-password`

### Slice 10: Build the forgot-password request form shell

- Scope: only `apps/web/src/app/auth/forgot-password/page.tsx`, `apps/web/src/app/auth/forgot-password/forgot-password-form.tsx`, and its test
- Goal: render the form, collect email, and inject dependencies for `requestPasswordReset(...)`
- Do not touch: reset-password page or reset form
- Done when: the test proves the request payload contains both `email` and `redirectTo`

### Slice 11: Add forgot-password success and error states

- Scope: only `apps/web/src/app/auth/forgot-password/page.tsx`, `apps/web/src/app/auth/forgot-password/forgot-password-form.tsx`, and its test
- Goal: show generic success copy, back-to-login navigation, and friendly error mapping without email enumeration
- Do not touch: reset-password form
- Done when: the test proves the success state is generic and the error mapping covers `INVALID_EMAIL` and rate-limit variants

### Slice 12: Add the reset-password page wrapper

- Scope: only `apps/web/src/app/auth/reset-password/page.tsx`
- Goal: normalize query params on the server and pass `token`/`error` into the client form
- Do not touch: reset form submit logic yet
- Done when: the page uses `readPasswordResetPageState(...)` as the single source of truth

### Slice 13: Build reset-password local validation and strength UX

- Scope: only `apps/web/src/app/auth/reset-password/reset-password-form.tsx` and its test
- Goal: enforce token presence, strong password rules, matching confirmation, and invalid-link states before any API call
- Do not touch: final success submit flow yet
- Done when: the test proves mismatch, missing token, and invalid-link behavior without relying on network calls

### Slice 14: Add reset-password submit, success, and API error handling

- Scope: only `apps/web/src/app/auth/reset-password/reset-password-form.tsx` and its test
- Goal: call `authClient.resetPassword(...)`, show success state, and map `INVALID_TOKEN` safely
- Do not touch: docs or route wrapper
- Done when: the test proves a strong password submits `newPassword + token` and success state appears

### Slice 15: Cover the request flow in Playwright

- Scope: only `apps/web/e2e/auth-password-reset.spec.ts`
- Goal: prove the user can navigate from login to forgot-password and submit a reset request
- Do not touch: business logic unless a selector/label adjustment is strictly needed
- Done when: the E2E scenario passes with a mocked `request-password-reset` response

### Slice 16: Cover the reset completion flow in Playwright

- Scope: only `apps/web/e2e/auth-password-reset.spec.ts`
- Goal: prove the user can open a valid token URL, define a new password, and see success
- Do not touch: backend behavior unless the UI is missing accessible selectors
- Done when: the E2E scenario passes with a mocked `reset-password` response

### Slice 17: Update architecture docs to reflect the real implementation

- Scope: only `docs/ARCHITECTURE.md`
- Goal: align versioning, Resend coverage, and route-hardening notes with the shipped reset-password flow
- Do not touch: feature code
- Done when: the doc diff only changes auth-related sections and mentions `Better Auth v1.6.1` plus password reset via Resend

### Slice 18: Run the final verification ladder

- Scope: verification only
- Goal: run focused tests, then `pnpm --filter web test`, `pnpm --filter web typecheck`, and finally `pnpm check`
- Do not touch: code unless a failing check requires a fix, in which case return to the smallest affected slice
- Done when: fresh command output proves the targeted flow and repo gates are green

## Execution Notes

- Slices 1-8 are backend/integration only. Do not start UI work before they are green.
- Slice 9 is intentionally isolated so the login entry point can be reviewed independently.
- Slices 10-11 cover request flow only; do not mix reset-form logic into them.
- Slices 12-14 cover reset flow only; keep request-flow files untouched unless a shared helper is missing.
- Slices 15-16 are E2E-only adjustments. If UI labels are unstable, prefer accessibility fixes over test-only hooks.
- Slice 18 is the only place where broad completion claims are allowed.

> The grouped tasks below remain the implementation reference, but execution should follow the atomic slice order above.

---

### Task 1: Lock the Real Password Reset Endpoint Behind Route-Level Rate Limiting

**Files:**
- Modify: `apps/web/src/app/api/auth/[...all]/route.test.ts`
- Modify: `apps/web/src/app/api/auth/[...all]/route.ts`

**Step 1: Write the failing test**

Add focused regression coverage in `apps/web/src/app/api/auth/[...all]/route.test.ts`:

```ts
test("POST /api/auth/request-password-reset is rate limited after 10 attempts from the same IP", async () => {
  const { POST } = await import("./route");

  for (let index = 0; index < 10; index += 1) {
    const response = await POST(
      new NextRequest("https://example.com/api/auth/request-password-reset", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.10" },
      }),
    );

    assert.notEqual(response.status, 429);
  }

  const limited = await POST(
    new NextRequest("https://example.com/api/auth/request-password-reset", {
      method: "POST",
      headers: { "x-forwarded-for": "203.0.113.10" },
    }),
  );

  assert.equal(limited.status, 429);
});
```

Add a second test with a different IP for `"/api/auth/forget-password"` only if backward compatibility protection is kept.

**Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm --filter web exec tsx --test src/app/api/auth/[...all]/route.test.ts
```

Expected: FAIL because `"/request-password-reset"` is not currently included in `RATE_LIMITED_PATHS`.

**Step 3: Implement the minimal fix**

Update `RATE_LIMITED_PATHS` in `apps/web/src/app/api/auth/[...all]/route.ts` to include:

```ts
const RATE_LIMITED_PATHS = [
  "/sign-in/email",
  "/sign-up/email",
  "/request-password-reset",
  "/forget-password",
] as const;
```

Keep the existing limit (`10 attempts per minute per IP per auth endpoint`) unchanged.

**Step 4: Re-run the targeted test**

Run:

```bash
pnpm --filter web exec tsx --test src/app/api/auth/[...all]/route.test.ts
```

Expected: PASS with the new password-reset rate limit covered.

**Step 5: Commit**

```bash
git add apps/web/src/app/api/auth/[...all]/route.ts apps/web/src/app/api/auth/[...all]/route.test.ts
git commit -m "test(auth): cover password reset rate limiting"
```

---

### Task 2: Add Shared Password Reset Path Helpers and Query-State Parsing

**Files:**
- Create: `apps/web/src/lib/password-reset.ts`
- Create: `apps/web/src/lib/password-reset.test.ts`

**Step 1: Write the failing test**

Create `apps/web/src/lib/password-reset.test.ts` with coverage for:

```ts
test("buildResetPasswordRedirectUrl joins the app url and reset path", () => {
  assert.equal(
    buildResetPasswordRedirectUrl("https://app.frescari.com"),
    "https://app.frescari.com/auth/reset-password",
  );
});

test("readPasswordResetPageState extracts token and invalid-token errors", () => {
  assert.deepEqual(
    readPasswordResetPageState(
      new URLSearchParams("token=abc123&error=INVALID_TOKEN"),
    ),
    {
      error: "INVALID_TOKEN",
      token: "abc123",
    },
  );
});
```

**Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/password-reset.test.ts
```

Expected: FAIL because the module does not exist yet.

**Step 3: Write the minimal helper module**

Create `apps/web/src/lib/password-reset.ts` with:

```ts
import { getAppUrl } from "./app-url";

export const FORGOT_PASSWORD_PATH = "/auth/forgot-password";
export const RESET_PASSWORD_PATH = "/auth/reset-password";

export function buildResetPasswordRedirectUrl(baseUrl = getAppUrl()) {
  return `${baseUrl.replace(/\/+$/, "")}${RESET_PASSWORD_PATH}`;
}

export function readPasswordResetPageState(searchParams: URLSearchParams) {
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  return {
    token: token?.trim() || null,
    error: error === "INVALID_TOKEN" ? "INVALID_TOKEN" : null,
  } as const;
}
```

**Step 4: Re-run the targeted test**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/password-reset.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/lib/password-reset.ts apps/web/src/lib/password-reset.test.ts
git commit -m "test(auth): add password reset path helpers"
```

---

### Task 3: Extend the Existing Resend Helper for Password Reset Emails

**Files:**
- Modify: `apps/web/src/lib/auth-email.ts`
- Modify: `apps/web/src/lib/auth-email.test.ts`

**Step 1: Write the failing test**

Add reset-email coverage to `apps/web/src/lib/auth-email.test.ts`:

```ts
test("buildAuthPasswordResetEmail includes the reset link and CTA", () => {
  const email = buildAuthPasswordResetEmail({
    user: {
      email: "buyer@example.com",
      name: "Comprador Frescari",
    },
    url: "https://app.frescari.com/auth/reset-password?token=abc123",
  });

  assert.equal(email.subject, "Redefina sua senha de acesso na Frescari");
  assert.match(email.text, /abc123/);
  assert.match(email.html, /Redefinir senha/);
});
```

Add a delivery test mirroring the existing verification flow:

```ts
await sendAuthPasswordResetEmail({
  user: {
    email: "buyer@example.com",
    name: "Comprador Frescari",
  },
  url: "https://app.frescari.com/auth/reset-password?token=abc123",
});
```

Expected payload highlights:
- `subject = "Redefina sua senha de acesso na Frescari"`
- `from = "Frescari <ops@frescari.com>"`
- `reply_to = "suporte@frescari.com"`

**Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/auth-email.test.ts
```

Expected: FAIL because the password reset email builder/sender does not exist yet.

**Step 3: Implement the minimal email extension**

In `apps/web/src/lib/auth-email.ts`:

- Extract the common Resend POST logic into a small private helper if it keeps the file DRY.
- Add:

```ts
export function buildAuthPasswordResetEmail(...) { ... }
export async function sendAuthPasswordResetEmail(...) { ... }
```

Use copy aligned with the product tone:
- subject: `Redefina sua senha de acesso na Frescari`
- CTA label: `Redefinir senha`
- footer: ignore the email if the request was not made by the user

In non-production without Resend config, log the reset URL exactly like the verification flow already does.

**Step 4: Re-run the targeted test**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/auth-email.test.ts
```

Expected: PASS with both verification and reset delivery paths green.

**Step 5: Commit**

```bash
git add apps/web/src/lib/auth-email.ts apps/web/src/lib/auth-email.test.ts
git commit -m "feat(auth): add resend password reset emails"
```

---

### Task 4: Extract and Wire Better Auth Password Reset Server Configuration

**Files:**
- Create: `apps/web/src/lib/auth-password.ts`
- Create: `apps/web/src/lib/auth-password.test.ts`
- Modify: `apps/web/src/lib/auth.ts`

**Step 1: Write the failing test**

Create `apps/web/src/lib/auth-password.test.ts`:

```ts
test("createEmailAndPasswordConfig enables reset password delivery and session revocation", async () => {
  let captured: unknown = null;

  const config = createEmailAndPasswordConfig({
    sendResetPasswordEmail: async (input) => {
      captured = input;
    },
  });

  assert.equal(config.enabled, true);
  assert.equal(config.requireEmailVerification, true);
  assert.equal(config.revokeSessionsOnPasswordReset, true);
  assert.equal(config.resetPasswordTokenExpiresIn, 60 * 60);

  await config.sendResetPassword?.({
    user: {
      email: "buyer@example.com",
      name: "",
    },
    url: "https://app.frescari.com/auth/reset-password?token=abc123",
  });

  assert.deepEqual(captured, {
    url: "https://app.frescari.com/auth/reset-password?token=abc123",
    user: {
      email: "buyer@example.com",
      name: "cliente Frescari",
    },
  });
});
```

**Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/auth-password.test.ts
```

Expected: FAIL because the helper module does not exist yet.

**Step 3: Implement the pure config helper and wire it into Better Auth**

Create `apps/web/src/lib/auth-password.ts` with a small factory:

```ts
import { PASSWORD_MIN_LENGTH } from "./password-policy";
import { sendAuthPasswordResetEmail } from "./auth-email";

export function createEmailAndPasswordConfig(...) {
  return {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthPasswordResetEmail({
        url,
        user: {
          email: user.email,
          name: user.name || "cliente Frescari",
        },
      });
    },
  } as const;
}
```

Then update `apps/web/src/lib/auth.ts` to replace the inline `emailAndPassword` object with:

```ts
emailAndPassword: createEmailAndPasswordConfig(),
```

Do **not** change the existing email verification behavior.

**Step 4: Re-run the targeted test**

Run:

```bash
pnpm --filter web exec tsx --test src/lib/auth-password.test.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/lib/auth-password.ts apps/web/src/lib/auth-password.test.ts apps/web/src/lib/auth.ts
git commit -m "feat(auth): wire better auth password reset config"
```

---

### Task 5: Build the Forgot Password Request Screen and Add the Login Entry Point

**Files:**
- Create: `apps/web/src/app/auth/forgot-password/page.tsx`
- Create: `apps/web/src/app/auth/forgot-password/forgot-password-form.tsx`
- Create: `apps/web/src/app/auth/forgot-password/forgot-password-form.test.tsx`
- Modify: `apps/web/src/app/auth/login/login-form.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/app/auth/forgot-password/forgot-password-form.test.tsx` using the existing JSDOM + `createRoot(...)` pattern from `apps/web/src/components/notification-bell.test.tsx`.

Cover:

```tsx
test("submits the email and shows generic success copy", async () => {
  const calls: unknown[] = [];

  await act(async () => {
    root.render(
      <ForgotPasswordForm
        requestPasswordReset={async (payload, callbacks) => {
          calls.push(payload);
          callbacks?.onSuccess?.();
        }}
        resetPasswordRedirectUrl="https://app.frescari.com/auth/reset-password"
      />,
    );
  });

  // fill email, submit, then assert success state
});
```

Assertions:
- the request payload contains `email`
- the request payload contains `redirectTo: "https://app.frescari.com/auth/reset-password"`
- success text is generic and does not reveal whether the account exists

**Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm --filter web exec tsx --test src/app/auth/forgot-password/forgot-password-form.test.tsx
```

Expected: FAIL because the page and form do not exist yet.

**Step 3: Implement the new request page**

Create `apps/web/src/app/auth/forgot-password/page.tsx` as a thin wrapper around the client form.

Create `apps/web/src/app/auth/forgot-password/forgot-password-form.tsx` with:

- email field
- CTA button
- back link to `/auth/login`
- generic success state after `authClient.requestPasswordReset(...)`
- local error mapping for:
  - `INVALID_EMAIL`
  - `TOO_MANY_REQUESTS`
  - `RATE_LIMITED`

For testability, accept dependency overrides:

```tsx
type ForgotPasswordFormProps = {
  requestPasswordReset?: typeof authClient.requestPasswordReset;
  resetPasswordRedirectUrl?: string;
};
```

Default behavior in production code:

```ts
requestPasswordReset = authClient.requestPasswordReset
resetPasswordRedirectUrl = buildResetPasswordRedirectUrl(window.location.origin)
```

Update `apps/web/src/app/auth/login/login-form.tsx` to add a visible text link such as:

```tsx
<Link href="/auth/forgot-password">Esqueci minha senha</Link>
```

Place it near the password field, above the submit button.

**Step 4: Re-run the targeted test**

Run:

```bash
pnpm --filter web exec tsx --test src/app/auth/forgot-password/forgot-password-form.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/auth/forgot-password/page.tsx apps/web/src/app/auth/forgot-password/forgot-password-form.tsx apps/web/src/app/auth/forgot-password/forgot-password-form.test.tsx apps/web/src/app/auth/login/login-form.tsx
git commit -m "feat(auth): add forgot password request flow"
```

---

### Task 6: Build the Reset Password Screen that Consumes Better Auth Tokens

**Files:**
- Create: `apps/web/src/app/auth/reset-password/page.tsx`
- Create: `apps/web/src/app/auth/reset-password/reset-password-form.tsx`
- Create: `apps/web/src/app/auth/reset-password/reset-password-form.test.tsx`

**Step 1: Write the failing test**

Create `apps/web/src/app/auth/reset-password/reset-password-form.test.tsx` with JSDOM coverage for:

```tsx
test("blocks submit when passwords do not match", async () => {
  await act(async () => {
    root.render(<ResetPasswordForm token="abc123" />);
  });

  // fill different passwords and submit
  // assert mismatch error is rendered
});

test("submits a strong password and shows success state", async () => {
  const calls: unknown[] = [];

  await act(async () => {
    root.render(
      <ResetPasswordForm
        token="abc123"
        resetPassword={async (payload, callbacks) => {
          calls.push(payload);
          callbacks?.onSuccess?.();
        }}
      />,
    );
  });

  // fill strong matching password, submit, assert success copy
});

test("shows invalid-link state when Better Auth returns INVALID_TOKEN in the query string", async () => {
  await act(async () => {
    root.render(<ResetPasswordForm token={null} error="INVALID_TOKEN" />);
  });

  assert.match(container.textContent ?? "", /link invalido|expirado/i);
});
```

**Step 2: Run the targeted test to verify it fails**

Run:

```bash
pnpm --filter web exec tsx --test src/app/auth/reset-password/reset-password-form.test.tsx
```

Expected: FAIL because the reset page/form do not exist yet.

**Step 3: Implement the reset page and form**

Create `apps/web/src/app/auth/reset-password/page.tsx` as a thin server component that passes normalized query state into the client form using `readPasswordResetPageState(...)`.

Create `apps/web/src/app/auth/reset-password/reset-password-form.tsx` with:

- token + error props
- new password field
- confirm password field
- show/hide password controls
- password criteria checklist reusing `getPasswordCriteria(...)`, `PASSWORD_MIN_LENGTH`, and `PASSWORD_POLICY_MESSAGE`
- local validation before calling Better Auth:
  - token required
  - password strength required
  - confirmation must match
- Better Auth submit:

```ts
authClient.resetPassword(
  {
    newPassword: password,
    token,
  },
  { ...callbacks }
);
```

- success state with CTA back to `/auth/login`
- invalid/expired-link state when:
  - `error === "INVALID_TOKEN"`
  - `token` is missing
  - the API returns `INVALID_TOKEN`

For testability, accept dependency injection:

```tsx
type ResetPasswordFormProps = {
  token: string | null;
  error?: "INVALID_TOKEN" | null;
  resetPassword?: typeof authClient.resetPassword;
};
```

**Step 4: Re-run the targeted test**

Run:

```bash
pnpm --filter web exec tsx --test src/app/auth/reset-password/reset-password-form.test.tsx
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/app/auth/reset-password/page.tsx apps/web/src/app/auth/reset-password/reset-password-form.tsx apps/web/src/app/auth/reset-password/reset-password-form.test.tsx
git commit -m "feat(auth): add password reset completion flow"
```

---

### Task 7: Add End-to-End Coverage for the Auth Reset Journey

**Files:**
- Create: `apps/web/e2e/auth-password-reset.spec.ts`

**Step 1: Write the failing Playwright spec**

Create `apps/web/e2e/auth-password-reset.spec.ts` with two scenarios:

```ts
test("user can request a password reset from the login screen", async ({ page }) => {
  let capturedRequestBody = "";

  await page.route("**/api/auth/request-password-reset", async (route) => {
    capturedRequestBody = route.request().postData() ?? "";
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/auth/login");
  await page.getByRole("link", { name: /esqueci minha senha/i }).click();
  await page.getByLabel(/e-mail/i).fill("buyer@example.com");
  await page.getByRole("button", { name: /enviar link/i }).click();

  await expect(page.getByText(/Se o email informado puder receber acesso/i)).toBeVisible();
  expect(capturedRequestBody).toContain("/auth/reset-password");
});
```

Second scenario:

```ts
test("user can define a new password from a valid reset token", async ({ page }) => {
  await page.route("**/api/auth/reset-password", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: true }),
    });
  });

  await page.goto("/auth/reset-password?token=e2e-token");
  await page.getByLabel(/nova senha/i).fill("NovaSenha123");
  await page.getByLabel(/confirmar senha/i).fill("NovaSenha123");
  await page.getByRole("button", { name: /redefinir senha/i }).click();

  await expect(page.getByText(/senha atualizada/i)).toBeVisible();
});
```

**Step 2: Run the targeted E2E spec to verify it fails**

Run:

```bash
pnpm --filter web test:e2e -- auth-password-reset.spec.ts
```

Expected: FAIL until the new pages and link exist.

**Step 3: Make only the minimal E2E-specific adjustments**

Only add stable selectors or accessible labels if the UI needs them. Do not add test-only business logic.

Examples:
- stable button labels
- stable field labels
- a success message unique enough for `getByText(...)`

**Step 4: Re-run the targeted E2E spec**

Run:

```bash
pnpm --filter web test:e2e -- auth-password-reset.spec.ts
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/e2e/auth-password-reset.spec.ts
git commit -m "test(auth): cover password reset e2e journey"
```

---

### Task 8: Update Architecture Documentation to Match the Real Auth Flow

**Files:**
- Modify: `docs/ARCHITECTURE.md`

**Step 1: Write the failing doc checklist**

Before editing, verify the current doc is stale in these two places:

- auth stack section still says `Better Auth v1.5.x`
- route hardening section still says `"/forget-password"` only

Treat this as the doc regression to fix.

**Step 2: Update the architecture doc**

In `docs/ARCHITECTURE.md`:

- change the auth stack version reference to `Better Auth v1.6.1`
- mention password reset email delivery through Resend alongside email verification
- update rate-limit coverage to mention `"/request-password-reset"` and note legacy compatibility for `"/forget-password"` only if it remains in code

Suggested wording:

```md
- Verificacao de e-mail e reset de senha por e-mail via Better Auth + Resend
```

**Step 3: Run a quick diff sanity check**

Run:

```bash
git diff -- docs/ARCHITECTURE.md
```

Expected: the auth section reflects the real implementation and no unrelated doc sections changed.

**Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md
git commit -m "docs(auth): document password reset flow"
```

---

## Final Verification Checklist

Run the focused suites first:

```bash
pnpm --filter web exec tsx --test src/app/api/auth/[...all]/route.test.ts
pnpm --filter web exec tsx --test src/lib/password-reset.test.ts
pnpm --filter web exec tsx --test src/lib/auth-email.test.ts
pnpm --filter web exec tsx --test src/lib/auth-password.test.ts
pnpm --filter web exec tsx --test src/app/auth/forgot-password/forgot-password-form.test.tsx
pnpm --filter web exec tsx --test src/app/auth/reset-password/reset-password-form.test.tsx
pnpm --filter web test:e2e -- auth-password-reset.spec.ts
```

Then run the package suite:

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

Finally run the repository gate:

```bash
pnpm check
```

Expected:
- all targeted tests pass
- Playwright auth reset spec passes
- no type errors
- no regressions in the broader monorepo quality gate

## Manual Smoke Checklist

- `/auth/login` shows a clear "Esqueci minha senha" link.
- `/auth/forgot-password` always shows generic success copy after a valid request, regardless of whether the email exists.
- In local dev without Resend config, the reset URL is logged to the terminal instead of crashing.
- In production-like env without Resend config, the reset email sender throws fast and clearly.
- The email body contains a CTA pointing to `/auth/reset-password?token=...`.
- `/auth/reset-password?error=INVALID_TOKEN` shows an invalid/expired link state.
- A strong matching password updates successfully and shows a success CTA back to login.
- Existing sign-in + sign-up flows still work and existing email verification screens are unchanged.
