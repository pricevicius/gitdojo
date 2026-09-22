import { Redis } from "ioredis";

export const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

function leaderboardKey(domainSlug: string): string {
  return `leaderboard:${domainSlug}`;
}

/** Substitui a pontuação do usuário naquele domínio pelo valor atual (não incrementa —
 * o score é recalculado inteiro a cada complete, ver routes/challenges.ts). */
export async function setLeaderboardScore(
  domainSlug: string,
  userId: string,
  score: number,
): Promise<void> {
  await redis.zadd(leaderboardKey(domainSlug), score, userId);
}

export interface LeaderboardRow {
  userId: string;
  score: number;
}

export async function getLeaderboard(domainSlug: string, limit: number): Promise<LeaderboardRow[]> {
  const raw = await redis.zrevrange(leaderboardKey(domainSlug), 0, limit - 1, "WITHSCORES");
  const rows: LeaderboardRow[] = [];
  for (let i = 0; i < raw.length; i += 2) {
    rows.push({ userId: raw[i], score: Number(raw[i + 1]) });
  }
  return rows;
}

export async function getLeaderboardRank(domainSlug: string, userId: string): Promise<number | null> {
  const rank = await redis.zrevrank(leaderboardKey(domainSlug), userId);
  return rank === null ? null : rank + 1;
}

const SESSION_PREFIX = "session:";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 dias

export async function createSession(token: string, userId: string): Promise<void> {
  await redis.set(`${SESSION_PREFIX}${token}`, userId, "EX", SESSION_TTL_SECONDS);
}

export async function getSessionUserId(token: string): Promise<string | null> {
  return redis.get(`${SESSION_PREFIX}${token}`);
}

export async function destroySession(token: string): Promise<void> {
  await redis.del(`${SESSION_PREFIX}${token}`);
}
