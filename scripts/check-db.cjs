// Quick connectivity check: lists CookieLens tables in the configured Postgres.
require("process").loadEnvFile(".env.local");
const { neon } = require("@neondatabase/serverless");
const sql = neon(process.env.DATABASE_URL);
sql`select table_name from information_schema.tables where table_schema='public' order by table_name`
  .then((r) => console.log(r.map((x) => x.table_name).join(", ")))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });