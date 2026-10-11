import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as {
fluidchatPool?: pg.Pool;
fluidchatDb?: ReturnType<typeof drizzle>;
};

function getConnectionString(): string {
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
throw new Error("DATABASE_URL is required");
}

return connectionString;
}

function getPool(): pg.Pool {
if (!globalForDb.fluidchatPool) {
globalForDb.fluidchatPool = new pg.Pool({
connectionString: getConnectionString(),
max: 3,
idleTimeoutMillis: 10000,
connectionTimeoutMillis: 10000,
});
}

return globalForDb.fluidchatPool;
}

function getDb() {
if (!globalForDb.fluidchatDb) {
globalForDb.fluidchatDb = drizzle(getPool(), { schema });
}

return globalForDb.fluidchatDb;
}

export const pool = new Proxy({} as pg.Pool, {
get(_target, property) {
const actualPool = getPool();
const value = Reflect.get(actualPool, property, actualPool);
return typeof value === "function" ? value.bind(actualPool) : value;
},
});

export const db = new Proxy({} as ReturnType<typeof drizzle>, {
get(_target, property) {
const actualDb = getDb();
const value = Reflect.get(actualDb, property, actualDb);
return typeof value === "function" ? value.bind(actualDb) : value;
},
});
