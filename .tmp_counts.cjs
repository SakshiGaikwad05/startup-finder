const { Pool } = require('pg');
const url = process.argv[2];
const pool = new Pool({ connectionString: url, max: 1 });
(async () => {
  const c = await pool.connect();
  try {
    const q = (t) => c.query(t).then(r => r.rows[0]);
    const total = await q("SELECT count(*)::int AS n FROM users");
    const new7d = await q("SELECT count(*)::int AS n FROM users WHERE created_at >= now() - interval '7 days'");
    const tryq = async (t) => { try { return await q(t); } catch (e) { return { n: null, err: e.message }; } };
    const dau = await tryq("SELECT count(DISTINCT user_id)::int AS n FROM user_events WHERE occurred_at >= CURRENT_DATE AND occurred_at < CURRENT_DATE + interval '1 day'");
    const wau = await tryq("SELECT count(DISTINCT user_id)::int AS n FROM user_events WHERE occurred_at >= now() - interval '7 days'");
    const mau = await tryq("SELECT count(DISTINCT user_id)::int AS n FROM user_events WHERE occurred_at >= now() - interval '30 days'");
    const returning7d = await tryq("SELECT count(DISTINCT u.id)::int AS n FROM users u JOIN user_events e ON e.user_id = u.id WHERE e.occurred_at >= now() - interval '7 days' AND u.created_at < now() - interval '7 days'");
    const dau_seen = await q("SELECT count(*)::int AS n FROM users WHERE last_seen_at >= CURRENT_DATE AND last_seen_at < CURRENT_DATE + interval '1 day'");
    const wau_seen = await q("SELECT count(*)::int AS n FROM users WHERE last_seen_at >= now() - interval '7 days'");
    const mau_seen = await q("SELECT count(*)::int AS n FROM users WHERE last_seen_at >= now() - interval '30 days'");
    const returning_seen7d = await q("SELECT count(*)::int AS n FROM users WHERE last_seen_at >= now() - interval '7 days' AND created_at < now() - interval '7 days'");
    console.log(JSON.stringify({ total, new7d, dau, wau, mau, returning7d, dau_seen, wau_seen, mau_seen, returning_seen7d }, null, 2));
  } finally { c.release(); await pool.end(); }
})().catch(e => { console.error(e.message); process.exit(1); });
