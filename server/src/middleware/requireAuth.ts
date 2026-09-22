import type { NextFunction, Request, Response } from "express";
import { getUserIdFromRequest } from "../auth/session.js";

export interface AuthedRequest extends Request {
  userId?: string;
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    res.status(401).json({ error: "not authenticated" });
    return;
  }
  req.userId = userId;
  next();
}
