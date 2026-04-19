import express from "express";
import pinoHttp from "pino-http";

import auctionRouter from "./routes/auction";
import dispatchRouter from "./routes/dispatch";
import healthRouter from "./routes/health";

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, Content-Length, X-Requested-With");
  // Intercept OPTIONS method
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(pinoHttp());

app.use(express.json());

app.use("/api", healthRouter);
app.use("/api", auctionRouter);
app.use("/api", dispatchRouter);

import path from "path";
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
