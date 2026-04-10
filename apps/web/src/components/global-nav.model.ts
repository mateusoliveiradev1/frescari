type PersonalMenuUser = {
  role?: string | null;
} | null;

export type PersonalMenuItem = {
  href: string;
  key: "account";
  label: "Minha Conta";
};

export function getPersonalMenuItems(
  user: PersonalMenuUser,
): PersonalMenuItem[] {
  if (!user?.role) {
    return [];
  }

  return [
    {
      href: "/conta",
      key: "account",
      label: "Minha Conta",
    },
  ];
}
