import crypto from "node:crypto";

import { pool } from "../src/db/pool";

const AUCTION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const ALICE_ID = "11111111-1111-1111-1111-111111111111";
const BOB_ID = "22222222-2222-2222-2222-222222222222";

async function prepareAuction(): Promise<void> {
  await pool.query("BEGIN");

  try {
    await pool.query(
      `UPDATE public.app_users
      SET wallet_balance = CASE id
        WHEN $1 THEN 20000
        WHEN $2 THEN 15000
        ELSE wallet_balance
      END
      WHERE id IN ($1, $2)`,
      [ALICE_ID, BOB_ID],
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

async function runRetractionDemo(): Promise<void> {
  await prepareAuction();

  const firstBid = await pool.query(
    "SELECT * FROM auction.place_bid($1, $2, $3, $4)",
    [AUCTION_ID, ALICE_ID, 200, crypto.randomUUID()],
  );

  const secondBid = await pool.query(
    "SELECT * FROM auction.place_bid($1, $2, $3, $4)",
    [AUCTION_ID, BOB_ID, 240, crypto.randomUUID()],
  );

  console.log("Before retraction:");
  console.table([firstBid.rows[0], secondBid.rows[0]]);

  const topBidIdResult = await pool.query(
    `SELECT id
    FROM auction.bids
    WHERE auction_id = $1
      AND bidder_id = $2
      AND bid_amount = 240
      AND is_active = TRUE
    ORDER BY created_at DESC
    LIMIT 1`,
    [AUCTION_ID, BOB_ID],
  );

  const topBidId = String(topBidIdResult.rows[0].id);

  const retractResult = await pool.query(
    "SELECT * FROM auction.retract_bid($1, $2)",
    [topBidId, "Demo retraction"],
  );

  const auctionState = await pool.query(
    `SELECT id, current_max_bid, current_winner_id
    FROM auction.auctions
    WHERE id = $1`,
    [AUCTION_ID],
  );

  console.log("Retraction result:");
  console.table(retractResult.rows);

  console.log("Auction after retraction (winner should change):");
  console.table(auctionState.rows);
}

runRetractionDemo()
  .catch((error: unknown) => {
    console.error("Retraction demo failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
