import { Router } from "express";

import { checkDbConnection } from "../db/pool";

const router = Router();

router.get("/health", async (_req, res) => {
  try {
    const isDbUp = await checkDbConnection();

    return res.status(200).json({
      status: "ok",
      database: isDbUp ? "up" : "down",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(200).json({
      status: "degraded",
      database: "down",
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
