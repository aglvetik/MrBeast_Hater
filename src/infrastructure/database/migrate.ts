import { migrate } from "drizzle-orm/node-postgres/migrator";

import { loadEnvConfig } from "../../config/env.js";
import { createDatabaseClient } from "./client.js";

async function main(): Promise<void> {
  const env = loadEnvConfig();
  const database = createDatabaseClient(env);

  try {
    await migrate(database.db, { migrationsFolder: "drizzle" });
    console.log("Database migrations applied.");
  } finally {
    await database.close();
  }
}

void main();
