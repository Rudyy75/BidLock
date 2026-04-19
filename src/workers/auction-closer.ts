import { pool } from "../db/pool";

async function closeExpiredAuctions(): Promise<void> {
  const result = await pool.query(
    `UPDATE auction.auctions
    SET status = 'CLOSED'
    WHERE status = 'ACTIVE'
      AND end_at <= NOW()
    RETURNING id, title, current_winner_id, current_max_bid`,
  );

  console.log(`Closed auctions: ${result.rowCount}`);

  for (const row of result.rows) {
    console.log(row);
  }
}

closeExpiredAuctions()
  .catch((error: unknown) => {
    console.error("Auction closer failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
