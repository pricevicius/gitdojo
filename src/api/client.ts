/**
 * Cliente fino do backend de ranking (ver docs/PLANO_RANKING.md). `domain` é
 * explícito em toda função que fala com uma rota escopada por domínio — não
 * assumido implicitamente — pra um segundo dojo não exigir reabrir este
 * arquivo, só passar outro slug.
 */

const BASE_URL = import.meta.env.VITE_API_URL as string | undefined;

/** Pseudo-domínio reservado no backend pro ranking unificado (soma de todos os dojos
 * que o usuário já jogou) — bate com GLOBAL_DOMAIN_SLUG em server/src/redis.ts. */
export const GLOBAL_DOMAIN = "global";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Sem VITE_API_URL configurada, o ranking simplesmente não está disponível
 * (build 100% estático continua funcionando sem backend). */
export function isRankingEnabled(): boolean {
  return Boolean(BASE_URL);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE_URL) throw new ApiError("VITE_API_URL não configurada", 0);
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error ?? `erro ${res.status}`, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface AuthUser {
  id: string;
  displayName: string;
}

export function register(email: string, password: string, displayName: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, displayName }),
  });
}

export function login(email: string, password: string): Promise<AuthUser> {
  return request<AuthUser>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout(): Promise<void> {
  return request<void>("/auth/logout", { method: "POST" });
}

export function getMe(): Promise<AuthUser> {
  return request<AuthUser>("/auth/me");
}

export interface CompleteChallengeResult {
  bestAttempts: number;
  timesCompleted: number;
  score: number;
}

export function completeChallenge(
  domain: string,
  challengeId: string,
  commandCount: number,
  trilha: string,
): Promise<CompleteChallengeResult> {
  return request<CompleteChallengeResult>(
    `/challenges/${encodeURIComponent(domain)}/${encodeURIComponent(challengeId)}/complete`,
    { method: "POST", body: JSON.stringify({ commandCount, trilha }) },
  );
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
}

export function getLeaderboard(domain: string, limit = 20): Promise<{ domain: string; entries: LeaderboardEntry[] }> {
  return request(`/leaderboard?domain=${encodeURIComponent(domain)}&limit=${limit}`);
}

export interface MyStats {
  domain: string;
  rank: number | null;
  score: number;
  bests: { domain: string; challengeSlug: string; bestAttempts: number; timesCompleted: number }[];
}

export function getMyStats(domain: string): Promise<MyStats> {
  return request(`/me/stats?domain=${encodeURIComponent(domain)}`);
}
