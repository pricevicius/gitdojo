import { Router } from "express";
import { prisma } from "../db.js";
import { hashPassword, verifyPassword } from "../auth/password.js";
import { startSession, endSession, getUserIdFromRequest } from "../auth/session.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const { email, password, displayName } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string" || typeof displayName !== "string") {
    res.status(400).json({ error: "email, password e displayName são obrigatórios" });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: "senha precisa ter pelo menos 8 caracteres" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: "password", providerAccountId: normalizedEmail } },
  });
  if (existing) {
    res.status(409).json({ error: "email já cadastrado" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      displayName: displayName.trim() || normalizedEmail,
      authIdentities: {
        create: {
          provider: "password",
          providerAccountId: normalizedEmail,
          passwordHash,
          email: normalizedEmail,
        },
      },
    },
  });

  await startSession(res, user.id);
  res.status(201).json({ id: user.id, displayName: user.displayName });
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "email e password são obrigatórios" });
    return;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const identity = await prisma.authIdentity.findUnique({
    where: { provider_providerAccountId: { provider: "password", providerAccountId: normalizedEmail } },
    include: { user: true },
  });
  if (!identity || !identity.passwordHash || !(await verifyPassword(password, identity.passwordHash))) {
    res.status(401).json({ error: "email ou senha inválidos" });
    return;
  }

  await startSession(res, identity.userId);
  res.json({ id: identity.user.id, displayName: identity.user.displayName });
});

authRouter.post("/logout", async (req, res) => {
  await endSession(req, res);
  res.status(204).end();
});

authRouter.get("/me", async (req, res) => {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  res.json({ id: user.id, displayName: user.displayName });
});
