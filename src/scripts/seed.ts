import path from "node:path";

import { pool } from "../db/pool";
import { executeSqlDirectory } from "./runSqlDirectory";

async function main(): Promise<void> {
  const root = process.cwd();
  const seedFolder = path.join(root, "db", "seed");

  await executeSqlDirectory(seedFolder);
  console.log("Database seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
