export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_POLICY_MESSAGE =
  "Use pelo menos 8 caracteres, com letra maiuscula, letra minuscula e numero.";

export type PasswordCriteria = {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
};

export function getPasswordCriteria(password: string): PasswordCriteria {
  return {
    hasMinLength: password.length >= PASSWORD_MIN_LENGTH,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /\d/.test(password),
  };
}

export function isStrongPassword(password: string) {
  const criteria = getPasswordCriteria(password);

  return (
    criteria.hasMinLength &&
    criteria.hasUppercase &&
    criteria.hasLowercase &&
    criteria.hasNumber
  );
}
