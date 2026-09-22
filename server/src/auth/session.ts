import { randomBytes } from "node:crypto";
import type { Request, Response } from "express";
import { createSession, destroySession, getSessionUserId } from "../redis.js";

export const SESSION_COOKIE = "gitdojo_session";

export async function startSession(res: Response, userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await createSession(token, userId);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export async function endSession(req: Request, res: Response): Promise<void> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await destroySession(token);
  res.clearCookie(SESSION_COOKIE);
}

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return null;
  return getSessionUserId(token);
}
