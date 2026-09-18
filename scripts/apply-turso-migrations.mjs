import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "fs";
import { join } from "path";

function statementsFromSql(sql) {
  const cleaned = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");
  return cleaned
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error("TURSO_DATABASE_URL e TURSO_AUTH_TOKEN são obrigatórios");
  }

  const client = createClient({ url, authToken });
  const migDir = join(process.cwd(), "prisma/migrations");
  const dirs = readdirSync(migDir)
    .filter((d) => !d.startsWith("."))
    .sort();

  for (const d of dirs) {
    const sql = readFileSync(join(migDir, d, "migration.sql"), "utf8");
    console.log("Applying", d);
    for (const stmt of statementsFromSql(sql)) {
      await client.execute(stmt);
    }
  }

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  );
  console.log(
    "Tables:",
    tables.rows.map((r) => r.name).join(", "),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
