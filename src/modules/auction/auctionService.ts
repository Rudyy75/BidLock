import crypto from "node:crypto";

import { pool } from "../../db/pool";
import { clearAuctionCache, getAuctionCache, setAuctionCache } from "../../lib/redis";
import { broadcastAuctionUpdate } from "../../lib/websocket";

type PlaceBidInput = {
  auctionId: string;
  userId: string;
  bidAmount: number;
  idempotencyKey?: string | undefined;
};

type PlaceBidResult = {
  bidId: string;
  winningBid: number;
  winnerId: string;
  retriesUsed: number;
};

const SERIALIZATION_FAILURE = "40001";
const MAX_BID_RETRIES = 3;

function normalizeBidRow(row: Record<string, unknown>): Omit<PlaceBidResult, "retriesUsed"> {
  return {
    bidId: String(row.bid_id),
    winningBid: Number(row.winning_bid),
    winnerId: String(row.winner_id),
  };
}

export async function placeBidWithRetry(input: PlaceBidInput): Promise<PlaceBidResult> {
  const idempotencyKey =
    input.idempotencyKey && input.idempotencyKey.trim().length > 0
      ? input.idempotencyKey
      : crypto.randomUUID();

  for (let attempt = 0; attempt < MAX_BID_RETRIES; attempt += 1) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");

      const result = await client.query(
        "SELECT * FROM auction.place_bid($1, $2, $3, $4)",
        [input.auctionId, input.userId, input.bidAmount, idempotencyKey],
      );

      await client.query("COMMIT");

      const row = result.rows[0];

      if (!row) {
        throw new Error("Bid placement returned no result");
      }

      const finalResult = {
        ...normalizeBidRow(row),
        retriesUsed: attempt,
      };

      await clearAuctionCache(input.auctionId);
      
      const snapshot = await getAuctionSnapshot(input.auctionId);
      broadcastAuctionUpdate(input.auctionId, snapshot);

      return finalResult;
    } catch (error) {
      await client.query("ROLLBACK");

      const pgError = error as Error & { code?: string };

      if (pgError.code === SERIALIZATION_FAILURE && attempt < MAX_BID_RETRIES - 1) {
        continue;
      }

      throw error;
    } finally {
      client.release();
    }
  }

  throw new Error("Bid placement failed after retries");
}

export async function retractBid(bidId: string, reason: string): Promise<{ newWinnerId: string | null; newWinningBid: number }> {
  const bidResult = await pool.query("SELECT auction_id FROM auction.bids WHERE id = $1", [bidId]);
  const auctionId = bidResult.rows[0]?.auction_id;

  const result = await pool.query(
    "SELECT * FROM auction.retract_bid($1, $2)",
    [bidId, reason],
  );

  const row = result.rows[0];

  if (!row) {
    throw new Error("Retraction returned no result");
  }

  if (auctionId) {
    await clearAuctionCache(auctionId);
    const snapshot = await getAuctionSnapshot(auctionId);
    broadcastAuctionUpdate(auctionId, snapshot);
  }

  return {
    newWinnerId: row.new_winner_id ? String(row.new_winner_id) : null,
    newWinningBid: Number(row.new_winning_bid ?? 0),
  };
}

export async function getAuctionSnapshot(auctionId: string): Promise<{
  auction: Record<string, unknown>;
  topBids: Array<Record<string, unknown>>;
}> {
  const cached = await getAuctionCache(auctionId);
  if (cached) {
    return cached;
  }

  const auctionResult = await pool.query(
    `SELECT
      a.id,
      a.title,
      a.status,
      a.current_max_bid,
      a.current_winner_id,
      a.min_increment,
      a.end_at
    FROM auction.auctions a
    WHERE a.id = $1`,
    [auctionId],
  );

  const auction = auctionResult.rows[0];

  if (!auction) {
    throw new Error("Auction not found");
  }

  const bidsResult = await pool.query(
    `SELECT
      b.id,
      b.bidder_id,
      b.bid_amount,
      b.created_at
    FROM auction.bids b
    WHERE b.auction_id = $1
      AND b.is_active = TRUE
    ORDER BY b.bid_amount DESC, b.created_at ASC
    LIMIT 5`,
    [auctionId],
  );

  const snapshotData = {
    auction,
    topBids: bidsResult.rows,
  };

  await setAuctionCache(auctionId, snapshotData);

  return snapshotData;
}
