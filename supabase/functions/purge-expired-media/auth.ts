function jwtRole(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const claims = JSON.parse(atob(padded));
    return typeof claims?.role === "string" ? claims.role : null;
  } catch {
    return null;
  }
}

export function isServiceCaller(
  authorization: string | null,
  serviceKey: string | undefined,
): boolean {
  if (!authorization?.startsWith("Bearer ")) return false;
  const token = authorization.slice("Bearer ".length).trim();
  if (!token) return false;
  if (serviceKey && token === serviceKey) return true;
  return jwtRole(token) === "service_role";
}
