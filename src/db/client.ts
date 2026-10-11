import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as unknown as {
  fluidchatPool?: pg.Pool;
};

export const pool =
  globalForDb.fluidchatPool ??
  new pg.Pool({
    connectionString,
    max: 3,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
  });

globalForDb.fluidchatPool = pool;

export const db = drizzle(pool, { schema });
