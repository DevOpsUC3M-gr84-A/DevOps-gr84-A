export const ROLE_ID_BY_NAME: Record<string, number> = {
  admin: 3,
  gestor: 1,
  lector: 2,
};

export const normalizeRoleToId = (role: unknown): number | null => {
  if (typeof role === "number") {
    return Number.isInteger(role) ? role : null;
  }

  if (typeof role !== "string") {
    return null;
  }

  const trimmed = role.trim();
  if (trimmed === "") {
    return null;
  }

  const numericRole = Number(trimmed);
  if (Number.isInteger(numericRole)) {
    return numericRole;
  }

  return ROLE_ID_BY_NAME[trimmed.toLowerCase()] ?? null;
};