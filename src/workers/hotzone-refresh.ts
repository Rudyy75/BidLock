import { pool } from "../db/pool";

async function refreshHotZones(): Promise<void> {
  await pool.query("REFRESH MATERIALIZED VIEW CONCURRENTLY dispatch.mv_hot_zones");
  console.log("Hot-zone materialized view refreshed.");
}

refreshHotZones()
  .catch((error: unknown) => {
    console.error("Hot-zone refresh failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
