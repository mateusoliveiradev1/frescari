type NormalizedAccountRole = "admin" | "buyer" | "fallback" | "producer";

export type AccountRole = string | null | undefined;

export type AccountSectionKey =
  | "perfil"
  | "cadastro"
  | "enderecos"
  | "seguranca";

export type AccountSectionDefinition = {
  href: `/conta/${AccountSectionKey}`;
  key: AccountSectionKey;
  label: string;
};

const ACCOUNT_SECTION_DEFINITIONS: Record<
  AccountSectionKey,
  AccountSectionDefinition
> = {
  cadastro: {
    href: "/conta/cadastro",
    key: "cadastro",
    label: "Cadastro",
  },
  enderecos: {
    href: "/conta/enderecos",
    key: "enderecos",
    label: "Enderecos",
  },
  perfil: {
    href: "/conta/perfil",
    key: "perfil",
    label: "Perfil",
  },
  seguranca: {
    href: "/conta/seguranca",
    key: "seguranca",
    label: "Seguranca",
  },
};

const ROLE_SECTION_KEYS: Record<NormalizedAccountRole, AccountSectionKey[]> = {
  admin: ["perfil", "seguranca"],
  buyer: ["perfil", "cadastro", "enderecos", "seguranca"],
  fallback: ["perfil", "seguranca"],
  producer: ["perfil", "cadastro", "seguranca"],
};

function normalizeAccountRole(role: AccountRole): NormalizedAccountRole {
  if (role === "admin" || role === "buyer" || role === "producer") {
    return role;
  }

  return "fallback";
}

export function getAccountSectionsForRole(role: AccountRole) {
  return ROLE_SECTION_KEYS[normalizeAccountRole(role)].map(
    (key) => ACCOUNT_SECTION_DEFINITIONS[key],
  );
}

export function getDefaultAccountPathForRole(role: AccountRole) {
  return getAccountSectionsForRole(role)[0]?.href ?? "/conta/perfil";
}

export function canAccessAccountSection(
  role: AccountRole,
  section: AccountSectionKey,
) {
  return getAccountSectionsForRole(role).some(
    (accountSection) => accountSection.key === section,
  );
}

export function getAccountSectionFromPathname(pathname: string) {
  for (const section of Object.values(ACCOUNT_SECTION_DEFINITIONS)) {
    if (pathname === section.href || pathname.startsWith(`${section.href}/`)) {
      return section.key;
    }
  }

  return null;
}
