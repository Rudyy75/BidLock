import { createServer } from "http";
import app from "./app";
import { env } from "./config/env";
import { pool } from "./db/pool";
import { connectRedis, disconnectRedis } from "./lib/redis";
import { initSocket } from "./lib/websocket";

const httpServer = createServer(app);
initSocket(httpServer);

const server = httpServer.listen(env.PORT, async () => {
  await connectRedis();
  console.log(`Server running on http://localhost:${env.PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}. Closing server...`);

  server.close(async () => {
    await disconnectRedis();
    await pool.end();
    console.log("Server closed cleanly.");
  });
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
