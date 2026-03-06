
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  // Fallback for local development so the app can start
  // even if a real database has not been configured yet. In production,
  // this avoids a hard startup crash and surfaces DB errors per-request.
  // Auth and any data persistence will not work without a real Postgres instance.
  // eslint-disable-next-line no-console
  console.warn(
    "DATABASE_URL is not set. Using default local Postgres URL postgres://localhost:5432/postgres. " +
      "Start a local Postgres instance or set DATABASE_URL to avoid connection errors when hitting the API.",
  );
}

export const pool = new Pool({
  connectionString: databaseUrl ?? "postgres://localhost:5432/postgres",
});
export const db = drizzle(pool, { schema });
