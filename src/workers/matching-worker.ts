import { pool } from "../db/pool";

async function runMatchingWorkerOnce(): Promise<void> {
  const pendingResult = await pool.query(
    `SELECT id
    FROM dispatch.ride_requests
    WHERE status = 'REQUESTED'
    ORDER BY requested_at ASC
    LIMIT 1`,
  );

  const requestId = pendingResult.rows[0]?.id as string | undefined;

  if (!requestId) {
    console.log("No pending ride requests found.");
    return;
  }

  const result = await pool.query(
    "SELECT * FROM dispatch.claim_driver_for_request($1, $2)",
    [requestId, "matching-worker-cli"],
  );

  console.log("Matching result:", result.rows[0]);
}

runMatchingWorkerOnce()
  .catch((error: unknown) => {
    console.error("Matching worker failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
