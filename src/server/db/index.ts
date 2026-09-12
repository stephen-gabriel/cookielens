import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set. Add your Neon pooled connection string to .env.local");
  }
  return url;
}

const sql = neon(getConnectionString());

export const db = drizzle(sql, { schema });
export { schema };

export type Db = typeof db;