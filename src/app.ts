import express from "express";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path from "path";

import authRouter from "./routes/auth";
import auctionRouter from "./routes/auction";
import dispatchRouter from "./routes/dispatch";
import healthRouter from "./routes/health";

const app = express();

app.use(helmet());

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use("/api/", globalLimiter);

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(pinoHttp());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api", healthRouter);
app.use("/api", auctionRouter);
app.use("/api", dispatchRouter);

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../test-socket.html"));
});

app.use((req, res) => {
  return res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  return res.status(500).json({
    message: err.message || "Internal server error",
  });
});

export default app;
