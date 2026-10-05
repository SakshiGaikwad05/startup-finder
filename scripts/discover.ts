// CLI version of "Find Startups Today": npm run discover
try {
  process.loadEnvFile(".env");
} catch {}
import("@/lib/discovery/run").then(async ({ runDiscovery }) => {
  const s = await runDiscovery((line) => console.log(line));
  console.log(JSON.stringify(s.stats));
  const { pool } = await import("@/lib/database");
  await pool().end();
});
