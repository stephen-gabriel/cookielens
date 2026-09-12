import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

let instance: ReturnType<typeof buildClient> | null = null;

function buildClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add your Neon pooled connection string to .env.local");
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

/**
 * Lazily-created DB client. Route modules import this file at build time,
 * so we must not throw until a query is actually executed.
 */
export function getDb() {
  if (!instance) instance = buildClient();
  return instance;
}

export { schema };
export type Db = ReturnType<typeof buildClient>;