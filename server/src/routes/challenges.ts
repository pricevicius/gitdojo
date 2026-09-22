import { Router } from "express";
import { prisma } from "../db.js";
import { setLeaderboardScore } from "../redis.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";

export const challengesRouter = Router();

async function recomputeScore(userId: string, domainId: string, domainSlug: string): Promise<number> {
  const bests = await prisma.challengeBest.findMany({
    where: { userId, challenge: { domainId } },
    select: { bestAttempts: true },
  });
  const score = bests.reduce((sum, b) => sum + 10 - (b.bestAttempts - 1), 0);
  await setLeaderboardScore(domainSlug, userId, score);
  return score;
}

/** Não reimplementa o goal() do frontend — confia no commandCount que ele manda
 * (aceitável nesta fase educacional; anti-cheat não é meta, ver docs/PLANO_RANKING.md). */
challengesRouter.post("/:domainSlug/:challengeSlug/complete", requireAuth, async (req: AuthedRequest, res) => {
  const { domainSlug, challengeSlug } = req.params;
  const { commandCount, trilha } = req.body ?? {};

  if (!Number.isInteger(commandCount) || commandCount < 1) {
    res.status(400).json({ error: "commandCount precisa ser um inteiro positivo" });
    return;
  }

  const domain = await prisma.domain.findUnique({ where: { slug: domainSlug } });
  if (!domain) {
    res.status(404).json({ error: `domínio '${domainSlug}' não existe` });
    return;
  }

  const challenge = await prisma.challenge.upsert({
    where: { domainId_slug: { domainId: domain.id, slug: challengeSlug } },
    update: {},
    create: { domainId: domain.id, slug: challengeSlug, trilha: typeof trilha === "string" ? trilha : "" },
  });

  const userId = req.userId!;

  await prisma.attempt.create({
    data: { userId, challengeId: challenge.id, commandCount },
  });

  const existingBest = await prisma.challengeBest.findUnique({
    where: { userId_challengeId: { userId, challengeId: challenge.id } },
  });

  const best = await prisma.challengeBest.upsert({
    where: { userId_challengeId: { userId, challengeId: challenge.id } },
    update: {
      bestAttempts: existingBest ? Math.min(existingBest.bestAttempts, commandCount) : commandCount,
      timesCompleted: { increment: 1 },
    },
    create: { userId, challengeId: challenge.id, bestAttempts: commandCount, timesCompleted: 1 },
  });

  const score = await recomputeScore(userId, domain.id, domain.slug);

  res.json({ bestAttempts: best.bestAttempts, timesCompleted: best.timesCompleted, score });
});
