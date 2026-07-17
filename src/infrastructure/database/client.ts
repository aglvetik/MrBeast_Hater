import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import type { Env } from "../../config/env.js";
import type { DatabaseSchema } from "./schema.js";
import * as schema from "./schema.js";

export interface DatabaseClient {
  readonly pool: Pool;
  readonly db: NodePgDatabase<DatabaseSchema>;
  close(): Promise<void>;
}

export function createDatabaseClient(env: Env): DatabaseClient {
  const pool = new Pool({
    connectionString: env.DATABASE_URL,
    max: env.NODE_ENV === "production" ? 20 : 10,
    application_name: "pingguard"
  });

  return {
    pool,
    db: drizzle(pool, { schema }),
    async close(): Promise<void> {
      await pool.end();
    }
  };
}
