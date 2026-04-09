import { isAuthEmailDeliveryConfigured } from "@/lib/auth-email";

import { ForgotPasswordForm } from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <ForgotPasswordForm
      emailDeliveryConfigured={isAuthEmailDeliveryConfigured()}
    />
  );
}
