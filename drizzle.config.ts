import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not read Next's .env.local automatically.
if (existsSync(".env.local")) {
  try {
    loadEnvFile(".env.local");
  } catch {
    // ignore — CLI will surface a missing-url error if needed
  }
}

export default defineConfig({
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  verbose: true,
  strict: true,
});