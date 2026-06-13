import express from "express";
import jwt from "jsonwebtoken";
import { pool } from "../db/pool";

const router = express.Router();
const JWT_SECRET: string = process.env.JWT_SECRET || "fallback_secret_for_development_only";

router.post("/login", async (req, res): Promise<any> => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ message: "userId is required" });
  }

  try {
    const { rows } = await pool.query("SELECT id FROM public.app_users WHERE id = $1", [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "24h" });
    return res.json({ token, userId });
  } catch (error: any) {
    req.log.error(error, "Login error");
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
