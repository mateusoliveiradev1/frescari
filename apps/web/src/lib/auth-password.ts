import { sendAuthPasswordResetEmail } from "@/lib/auth-email";
import { PASSWORD_MIN_LENGTH } from "@/lib/password-policy";

type PasswordResetEmailInput = {
  url: string;
  user: {
    email: string;
    name: string;
  };
};

type CreateEmailAndPasswordConfigOptions = {
  sendPasswordResetEmail?: (
    input: PasswordResetEmailInput,
  ) => Promise<void> | void;
};

export function createEmailAndPasswordConfig(
  options: CreateEmailAndPasswordConfigOptions = {},
) {
  const sendPasswordResetEmail =
    options.sendPasswordResetEmail ?? sendAuthPasswordResetEmail;

  return {
    enabled: true,
    minPasswordLength: PASSWORD_MIN_LENGTH,
    requireEmailVerification: true,
    resetPasswordTokenExpiresIn: 60 * 60,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({
      user,
      url,
    }: {
      user: {
        email: string;
        name?: string | null;
      };
      url: string;
      token: string;
    }) => {
      await sendPasswordResetEmail({
        url,
        user: {
          email: user.email,
          name: user.name?.trim() || "cliente Frescari",
        },
      });
    },
  } as const;
}
