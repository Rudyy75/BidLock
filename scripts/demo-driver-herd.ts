import { pool } from "../src/db/pool";

const RIDER_ID = "11111111-1111-1111-1111-111111111111";

async function createRequestForDemo(): Promise<string> {
  await pool.query(
    `UPDATE dispatch.active_drivers
    SET is_available = TRUE,
        current_load = 0,
        updated_at = NOW()`,
  );

  const result = await pool.query(
    `INSERT INTO dispatch.ride_requests (
      rider_id,
      pickup_location,
      drop_location,
      vehicle_type,
      status
    )
    VALUES (
      $1,
      ST_SetSRID(ST_MakePoint(77.2190, 28.6320), 4326),
      ST_SetSRID(ST_MakePoint(77.2290, 28.6450), 4326),
      'CAR',
      'REQUESTED'
    )
    RETURNING id`,
    [RIDER_ID],
  );

  return String(result.rows[0].id);
}

async function runDriverHerdDemo(): Promise<void> {
  const requestId = await createRequestForDemo();

  const attempts = Array.from({ length: 20 }, (_, index) => {
    const workerName = `worker-${index + 1}`;

    return pool.query(
      "SELECT * FROM dispatch.claim_driver_for_request($1, $2)",
      [requestId, workerName],
    );
  });

  const results = await Promise.all(attempts);

  console.log(`Ride request tested: ${requestId}`);
  console.table(results.map((result) => result.rows[0]));

  const acceptedCount = await pool.query(
    `SELECT COUNT(*)::INT AS accepted_count
    FROM dispatch.matching_log
    WHERE request_id = $1
      AND decision = 'ACCEPTED'`,
    [requestId],
  );

  const finalRide = await pool.query(
    `SELECT id, status, matched_driver_id
    FROM dispatch.ride_requests
    WHERE id = $1`,
    [requestId],
  );

  console.log("Exactly one accepted match expected.");
  console.table(acceptedCount.rows);
  console.table(finalRide.rows);
}

runDriverHerdDemo()
  .catch((error: unknown) => {
    console.error("Driver herd demo failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
