import { Router } from "express";
import { prisma } from "../db.js";
import { GLOBAL_DOMAIN_SLUG, setLeaderboardScore } from "../redis.js";
import { requireAuth, type AuthedRequest } from "../middleware/requireAuth.js";

export const challengesRouter = Router();

function scoreFromBests(bests: { bestAttempts: number }[]): number {
  return bests.reduce((sum, b) => sum + 10 - (b.bestAttempts - 1), 0);
}

/** Recalcula tanto o score do domínio quanto o score global (soma de todos os dojos que
 * o usuário já jogou) e atualiza os dois sorted sets no Redis — é assim que um dojo novo
 * (ex: docker) entra automaticamente no ranking unificado, sem código extra. */
async function recomputeScores(userId: string, domainId: string, domainSlug: string): Promise<number> {
  const [domainBests, allBests] = await Promise.all([
    prisma.challengeBest.findMany({ where: { userId, challenge: { domainId } }, select: { bestAttempts: true } }),
    prisma.challengeBest.findMany({ where: { userId }, select: { bestAttempts: true } }),
  ]);

  const domainScore = scoreFromBests(domainBests);
  const globalScore = scoreFromBests(allBests);

  await Promise.all([
    setLeaderboardScore(domainSlug, userId, domainScore),
    setLeaderboardScore(GLOBAL_DOMAIN_SLUG, userId, globalScore),
  ]);

  return domainScore;
}

/** Não reimplementa o goal() do frontend — confia no commandCount que ele manda
 * (aceitável nesta fase educacional; anti-cheat não é meta, ver docs/PLANO_RANKING.md). */
challengesRouter.post("/:domainSlug/:challengeSlug/complete", requireAuth, async (req: AuthedRequest, res) => {
  const { domainSlug, challengeSlug } = req.params;
  const { commandCount, trilha } = req.body ?? {};

  if (domainSlug === GLOBAL_DOMAIN_SLUG) {
    res.status(400).json({ error: `'${GLOBAL_DOMAIN_SLUG}' é reservado pro ranking unificado, não é um domínio` });
    return;
  }
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

  const score = await recomputeScores(userId, domain.id, domain.slug);

  res.json({ bestAttempts: best.bestAttempts, timesCompleted: best.timesCompleted, score });
});
