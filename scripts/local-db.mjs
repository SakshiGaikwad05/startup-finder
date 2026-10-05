// Project-local PostgreSQL (alternative to Docker). Uses initdb/pg_ctl from your PostgreSQL install.
//   node scripts/local-db.mjs start   → creates ./.pgdata on first run, starts on port 5433
//   node scripts/local-db.mjs stop
// Credentials match .env.example: startup / startup, database startup_finder.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DATA = path.join(process.cwd(), ".pgdata");
const PORT = "5433";
const cmd = process.argv[2] ?? "start";

function run(bin, args, opts = {}) {
  const r = spawnSync(bin, args, { stdio: "inherit", ...opts });
  if (r.error) {
    console.error(`Could not run ${bin}: ${r.error.message}. Is PostgreSQL's bin folder on PATH?`);
    process.exit(1);
  }
  return r.status ?? 1;
}

if (cmd === "stop") {
  process.exit(run("pg_ctl", ["-D", DATA, "stop", "-m", "fast"]));
}

if (!fs.existsSync(path.join(DATA, "PG_VERSION"))) {
  const pw = path.join(os.tmpdir(), `sf-pw-${process.pid}`);
  fs.writeFileSync(pw, "startup\n");
  const code = run("initdb", ["-D", DATA, "-U", "startup", `--pwfile=${pw}`, "-A", "scram-sha-256", "-E", "UTF8"]);
  fs.rmSync(pw, { force: true });
  if (code !== 0) process.exit(code);
}

const status = spawnSync("pg_ctl", ["-D", DATA, "status"], { encoding: "utf8" });
if (status.status !== 0) {
  // stdio "ignore" so the long-running server doesn't hold this script's output pipe open.
  const code = run("pg_ctl", ["-D", DATA, "-l", path.join(DATA, "server.log"), "-o", `-p ${PORT} -h localhost`, "-w", "start"], { stdio: "ignore" });
  if (code !== 0) {
    console.error(`pg_ctl start failed — see ${path.join(DATA, "server.log")}`);
    process.exit(code);
  }
  console.log("Local PostgreSQL started on port " + PORT);
} else {
  console.log("Local PostgreSQL already running.");
}

// Create the database if needed.
const env = { ...process.env, PGPASSWORD: "startup" };
const exists = spawnSync("psql", ["-h", "localhost", "-p", PORT, "-U", "startup", "-d", "postgres", "-tAc",
  "SELECT 1 FROM pg_database WHERE datname='startup_finder'"], { encoding: "utf8", env });
if (!String(exists.stdout).includes("1")) {
  run("psql", ["-h", "localhost", "-p", PORT, "-U", "startup", "-d", "postgres", "-c", "CREATE DATABASE startup_finder"], { env });
}
console.log(`PostgreSQL ready: postgresql://startup:startup@localhost:${PORT}/startup_finder`);
