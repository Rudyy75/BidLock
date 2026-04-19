import crypto from "node:crypto";

import { pool } from "../src/db/pool";

const AUCTION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";

const bidders = [
  { userId: "11111111-1111-1111-1111-111111111111", amount: 150 },
  { userId: "22222222-2222-2222-2222-222222222222", amount: 170 },
  { userId: "33333333-3333-3333-3333-333333333333", amount: 190 },
  { userId: "11111111-1111-1111-1111-111111111111", amount: 210 },
  { userId: "22222222-2222-2222-2222-222222222222", amount: 230 },
  { userId: "33333333-3333-3333-3333-333333333333", amount: 250 },
];

async function resetAuctionState(): Promise<void> {
  await pool.query("BEGIN");

  try {
    await pool.query(
      `UPDATE public.app_users
      SET wallet_balance = CASE id
        WHEN '11111111-1111-1111-1111-111111111111' THEN 20000
        WHEN '22222222-2222-2222-2222-222222222222' THEN 15000
        WHEN '33333333-3333-3333-3333-333333333333' THEN 25000
        ELSE wallet_balance
      END
      WHERE id IN (
        '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222',
        '33333333-3333-3333-3333-333333333333'
      )`,
    );

    await pool.query("DELETE FROM auction.wallet_holds WHERE auction_id = $1", [AUCTION_ID]);
    await pool.query("DELETE FROM auction.bids WHERE auction_id = $1", [AUCTION_ID]);

    await pool.query(
      `UPDATE auction.auctions
      SET status = 'ACTIVE',
          current_max_bid = 0,
          current_winner_id = NULL,
          end_at = NOW() + INTERVAL '2 hours'
      WHERE id = $1`,
      [AUCTION_ID],
    );

    await pool.query("COMMIT");
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

async function runBidRaceDemo(): Promise<void> {
  await resetAuctionState();

  const promises = bidders.map(async (bidder) => {
    try {
      const response = await fetch(`http://localhost:3000/api/auctions/${AUCTION_ID}/bids`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: bidder.userId,
          bidAmount: bidder.amount,
          idempotencyKey: crypto.randomUUID()
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const result = await response.json();

      return {
        userId: bidder.userId,
        bidAmount: bidder.amount,
        status: "ACCEPTED",
        result: result,
      };
    } catch (error) {
      return {
        userId: bidder.userId,
        bidAmount: bidder.amount,
        status: "REJECTED",
        error: (error as Error).message,
      };
    }
  });

  const outcomes = await Promise.all(promises);
  console.table(outcomes);

  const finalAuction = await pool.query(
    `SELECT id, current_max_bid, current_winner_id, status
    FROM auction.auctions
    WHERE id = $1`,
    [AUCTION_ID],
  );

  const balances = await pool.query(
    `SELECT id, name, wallet_balance
    FROM public.app_users
    WHERE id IN (
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    )
    ORDER BY name ASC`,
  );

  console.log("Final auction state:");
  console.table(finalAuction.rows);

  console.log("Wallet balances after race:");
  console.table(balances.rows);
}

runBidRaceDemo()
  .catch((error: unknown) => {
    console.error("Bid race demo failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
