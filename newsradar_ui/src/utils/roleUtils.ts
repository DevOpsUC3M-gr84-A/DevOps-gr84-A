export const ROLE_ID_BY_NAME: Record<string, number> = {
  admin: 3,
  gestor: 1,
  lector: 2,
};

export const normalizeRoleToId = (role: unknown): number => {
  if (role === 1 || role === "1") {
    return 1;
  }

  if (role === 3 || role === "3") {
    return 3;
  }

  if (typeof role === "string") {
    const normalized = role.trim().toLowerCase();

    if (normalized === "gestor") {
      return 1;
    }

    if (normalized === "admin") {
      return 3;
    }
  }

  return 2;
};