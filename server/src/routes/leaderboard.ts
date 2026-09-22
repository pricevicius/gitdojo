import { Router } from "express";
import { prisma } from "../db.js";
import { getLeaderboard, getLeaderboardRank } from "../redis.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";

export const leaderboardRouter = Router();

leaderboardRouter.get("/leaderboard", async (req, res) => {
  const domainSlug = String(req.query.domain ?? "");
  const limit = Math.min(Math.max(Number(req.query.limit ?? 20) || 20, 1), 100);
  if (!domainSlug) {
    res.status(400).json({ error: "parâmetro 'domain' é obrigatório" });
    return;
  }

  const rows = await getLeaderboard(domainSlug, limit);
  if (rows.length === 0) {
    res.json({ domain: domainSlug, entries: [] });
    return;
  }

  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, displayName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.displayName]));

  res.json({
    domain: domainSlug,
    entries: rows.map((r, i) => ({
      rank: i + 1,
      userId: r.userId,
      displayName: nameById.get(r.userId) ?? "???",
      score: r.score,
    })),
  });
});

leaderboardRouter.get("/me/stats", requireAuth, async (req: AuthedRequest, res) => {
  const domainSlug = String(req.query.domain ?? "");
  if (!domainSlug) {
    res.status(400).json({ error: "parâmetro 'domain' é obrigatório" });
    return;
  }

  const domain = await prisma.domain.findUnique({ where: { slug: domainSlug } });
  if (!domain) {
    res.json({ domain: domainSlug, rank: null, score: 0, bests: [] });
    return;
  }

  const userId = req.userId!;
  const [bests, rank] = await Promise.all([
    prisma.challengeBest.findMany({
      where: { userId, challenge: { domainId: domain.id } },
      include: { challenge: { select: { slug: true } } },
    }),
    getLeaderboardRank(domainSlug, userId),
  ]);

  const score = bests.reduce((sum, b) => sum + 10 - (b.bestAttempts - 1), 0);

  res.json({
    domain: domainSlug,
    rank,
    score,
    bests: bests.map((b) => ({
      challengeSlug: b.challenge.slug,
      bestAttempts: b.bestAttempts,
      timesCompleted: b.timesCompleted,
    })),
  });
});
