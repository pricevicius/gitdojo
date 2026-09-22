import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { challengesRouter } from "./routes/challenges.js";
import { leaderboardRouter } from "./routes/leaderboard.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);
const origin = process.env.CORS_ORIGIN ?? "http://localhost:5173";

app.use(cors({ origin, credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRouter);
app.use("/challenges", challengesRouter);
app.use("/", leaderboardRouter);

app.listen(port, () => {
  console.log(`ranking api ouvindo em http://localhost:${port}`);
});
