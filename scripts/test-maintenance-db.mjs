// Runs fixture-based integration checks in transactions that always roll back.
// --rehearse also applies pending migrations inside each rolled-back transaction.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--linked") ? "--linked" : "--local";
if (process.argv.includes("--rehearse") && target !== "--linked") throw new Error("--rehearse requires --linked.");
const stripTransaction = (sql) => sql.replace(/^(begin|commit|rollback);\s*$/gmi, "");
let migrations = "";
if (process.argv.includes("--rehearse")) {
  const result = JSON.parse(execFileSync("supabase", ["migration", "list", "--linked", "--output-format", "json"], { encoding: "utf8" }));
  const pending = new Set(result.migrations.filter((m) => m.local && !m.remote).map((m) => m.local));
  migrations = readdirSync("supabase/migrations").sort().filter((name) => pending.has(name.split("_")[0]))
    .map((name) => stripTransaction(readFileSync(join("supabase/migrations", name), "utf8"))).join("\n");
}
const directory = mkdtempSync(join(tmpdir(), "maintenance-db-tests-"));
const suites = readdirSync("supabase/tests").filter(name => name.endsWith(".sql")).map(name => name.slice(0, -4)).sort();
const selectedSuite = process.argv.find((argument) => argument.startsWith("--suite="))?.slice("--suite=".length);
if (selectedSuite && !suites.includes(selectedSuite)) throw new Error("Unknown maintenance test suite.");
try {
  for (const name of selectedSuite ? [selectedSuite] : suites) {
    let sql = stripTransaction(readFileSync(`supabase/tests/${name}.sql`, "utf8"));
    let prefix = "begin;\nset local statement_timeout='25s';\nset local lock_timeout='3s';\n" + migrations + "\n";
    if (name.startsWith("listing_")) prefix += readFileSync("supabase/tests/fixtures/listing.sql", "utf8") + "\n";
    if (name === "maintenance_rls") {
      prefix += "create extension if not exists pgtap with schema extensions;\nset local search_path=public,extensions;\ncreate temp table maintenance_test_results(result text);\ngrant all on maintenance_test_results to anon,authenticated;\n";
      sql = sql.replace(/^select (ok|is_empty|throws_ok)\(/gm, "insert into maintenance_test_results select $1(");
      sql = sql.replace("select * from finish();", () => `reset role;
        insert into maintenance_test_results select * from finish();
        do $$ declare failures text; begin
          select string_agg(result, E'\\n') into failures from maintenance_test_results
          where result like 'not ok%' or result like '#%';
          if failures is not null then raise exception '%', failures; end if;
        end $$;
        select count(*) as passing_rls_checks from maintenance_test_results;`);
    }
    const file = join(directory, `${name}.sql`);
    writeFileSync(file, prefix + sql + "\nrollback;\n");
    execFileSync("supabase", ["db", "query", target, "--file", file], { stdio: "inherit" });
    console.info(`${name}: passed; transaction rolled back.`);
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
