import fs from "node:fs/promises";
import path from "node:path";

import { pool } from "../db/pool";

export async function executeSqlDirectory(directoryPath: string): Promise<void> {
  const files = (await fs.readdir(directoryPath))
    .filter((file) => file.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  for (const file of files) {
    const filePath = path.join(directoryPath, file);
    const sql = await fs.readFile(filePath, "utf8");

    if (sql.trim().length === 0) {
      continue;
    }

    console.log(`Running SQL: ${filePath}`);
    await pool.query(sql);
  }
}
