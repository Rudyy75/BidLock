import { createClient } from "redis";
import { env } from "../config/env";

export const redisClient = createClient({
  url: env.REDIS_URL,
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log("Redis connected successfully.");
  }
}

export async function disconnectRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}

export async function getAuctionCache(auctionId: string) {
  const data = await redisClient.get(`auction:${auctionId}`);
  return data ? JSON.parse(data) : null;
}

export async function setAuctionCache(auctionId: string, data: unknown) {
  // Cache for 60 seconds (useful during high-contention periods)
  await redisClient.setEx(`auction:${auctionId}`, 60, JSON.stringify(data));
}

export async function clearAuctionCache(auctionId: string) {
  await redisClient.del(`auction:${auctionId}`);
}
