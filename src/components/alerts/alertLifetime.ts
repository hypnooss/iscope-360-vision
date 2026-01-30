export const DEFAULT_BANNER_LIFETIME_MS = 30_000;
// M365 tende a exigir ação do usuário; deixamos um tempo maior por padrão.
export const M365_BANNER_LIFETIME_MS = 5 * 60_000;

export function getAlertLifetimeMs(alertType: string): number {
  if (alertType?.startsWith("m365_")) return M365_BANNER_LIFETIME_MS;
  return DEFAULT_BANNER_LIFETIME_MS;
}

export function getAlertAgeMs(createdAt: string, nowMs: number = Date.now()): number {
  const createdMs = new Date(createdAt).getTime();
  const rawAge = nowMs - createdMs;
  // Mitiga clock skew (created_at “no futuro” no client)
  return Math.max(0, rawAge);
}
