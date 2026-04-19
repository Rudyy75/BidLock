import fs from "node:fs/promises";
import path from "node:path";

import { pool } from "../db/pool";
import { executeSqlDirectory } from "./runSqlDirectory";

async function directoryExists(directoryPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(directoryPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const root = process.cwd();
  const folders = [
    path.join(root, "db", "migrations"),
    path.join(root, "db", "functions"),
    path.join(root, "db", "triggers"),
  ];

  for (const folder of folders) {
    if (!(await directoryExists(folder))) {
      continue;
    }

    await executeSqlDirectory(folder);
  }

  console.log("Database migration completed.");
}

main()
  .catch((error: unknown) => {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
