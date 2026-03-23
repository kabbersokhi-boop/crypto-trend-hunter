/**
 * server.js — Express backend for Trend Analyzer
 *
 * Endpoints:
 *   POST /webhook/n8n           receives Reddit posts + prices from n8n
 *   GET  /api/trends            top trending topics
 *   GET  /api/sentiment         sentiment summary per topic
 *   GET  /api/sentiment/history sentiment over time for one topic
 *   GET  /api/prices            latest crypto prices
 *   GET  /api/correlations      HOT/COOLING/NEUTRAL per coin
 *   GET  /api/report            latest AI market report
 *   GET  /api/stats             dashboard header stats
 *   POST /api/trigger           manually trigger Python pipeline
 *   GET  /api/trigger/status    pipeline running status
 *   GET  /api/health            health check
 */

require("dotenv").config({ path: "../.env" });

const express    = require("express");
const cors       = require("cors");
const { spawn }  = require("child_process");
const path       = require("path");
const { initDb, all, get, run, insertMany } = require("./db");

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json({ limit: "5mb" }));

initDb();

// ── Pipeline state ────────────────────────────────────────────
let pipelineRunning = false;
let lastRunAt       = null;
let lastRunStatus   = "never";

function triggerPipeline(agentNum = null) {
  if (pipelineRunning) {
    console.log("[Pipeline] Already running — skipping");
    return;
  }
  pipelineRunning = true;
  lastRunStatus   = "running";

  const agentsDir = path.join(__dirname, "..", "agents");
  const args      = ["run_pipeline.py"];
  if (agentNum) args.push("--agent", String(agentNum));

  console.log(`[Pipeline] Starting${agentNum ? ` Agent ${agentNum}` : " full pipeline"}...`);

  const child = spawn("python3", args, {
    cwd: agentsDir,
    env: { ...process.env },
  });

  child.stdout.on("data", (d) => process.stdout.write(`[py] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[py:err] ${d}`));

  child.on("close", (code) => {
    pipelineRunning = false;
    lastRunAt       = new Date().toISOString();
    lastRunStatus   = code === 0 ? "success" : `failed (exit ${code})`;
    console.log(`[Pipeline] Finished — exit ${code}`);
  });
}

// ── Webhook — receives data from n8n ─────────────────────────
app.post("/webhook/n8n", (req, res) => {
  const { type, data } = req.body;

  if (!type || !Array.isArray(data)) {
    return res.status(400).json({ error: "Body must be { type, data[] }" });
  }

  try {
    if (type === "posts") {
      insertMany(`
        INSERT OR IGNORE INTO posts
          (id, subreddit, title, content, score, num_comments, url, author, created_at)
        VALUES
          (@id, @subreddit, @title, @content, @score, @num_comments, @url, @author, @created_at)
      `, data);
      console.log(`[Webhook] ${data.length} posts inserted`);
      triggerPipeline(1);
      return res.json({ ok: true, inserted: data.length, type: "posts" });
    }

    if (type === "prices") {
      insertMany(`
        INSERT INTO prices
          (coin_id, coin_name, coin_symbol, price_usd,
           price_change_24h, price_change_7d, volume_24h, market_cap)
        VALUES
          (@coin_id, @coin_name, @coin_symbol, @price_usd,
           @price_change_24h, @price_change_7d, @volume_24h, @market_cap)
      `, data);
      console.log(`[Webhook] ${data.length} prices inserted`);
      return res.json({ ok: true, inserted: data.length, type: "prices" });
    }

    return res.status(400).json({ error: `Unknown type: ${type}` });
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/trends ───────────────────────────────────────────
app.get("/api/trends", (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const limit = parseInt(req.query.limit) || 10;
  const rows  = all(
    `SELECT * FROM trends
     WHERE detected_at >= datetime('now', ?)
     ORDER BY momentum_score DESC LIMIT ?`,
    [`-${hours} hours`, limit]
  );
  res.json({ ok: true, count: rows.length, data: rows });
});

// ── GET /api/sentiment ────────────────────────────────────────
app.get("/api/sentiment", (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const rows  = all(
    `SELECT
       topic,
       COUNT(*)  AS mention_count,
       AVG(sentiment_score) AS avg_sentiment,
       SUM(CASE WHEN sentiment_label='positive' THEN 1 ELSE 0 END) AS positive_count,
       SUM(CASE WHEN sentiment_label='negative' THEN 1 ELSE 0 END) AS negative_count,
       SUM(CASE WHEN sentiment_label='neutral'  THEN 1 ELSE 0 END) AS neutral_count,
       MAX(analysed_at) AS last_seen
     FROM sentiment
     WHERE analysed_at >= datetime('now', ?)
     GROUP BY topic
     ORDER BY mention_count DESC`,
    [`-${hours} hours`]
  );
  const cleaned = rows.map(r => ({ ...r, avg_sentiment: Math.round(r.avg_sentiment * 1000) / 1000 }));
  res.json({ ok: true, count: cleaned.length, data: cleaned });
});

// ── GET /api/sentiment/history ────────────────────────────────
app.get("/api/sentiment/history", (req, res) => {
  const { topic } = req.query;
  const hours     = parseInt(req.query.hours) || 48;
  if (!topic) return res.status(400).json({ error: "topic param required" });
  const rows = all(
    `SELECT
       strftime('%Y-%m-%d %H:00:00', analysed_at) AS hour,
       AVG(sentiment_score) AS avg_sentiment,
       COUNT(*) AS mention_count
     FROM sentiment
     WHERE topic = ? AND analysed_at >= datetime('now', ?)
     GROUP BY hour ORDER BY hour ASC`,
    [topic, `-${hours} hours`]
  );
  res.json({ ok: true, topic, data: rows });
});

// ── GET /api/prices ───────────────────────────────────────────
app.get("/api/prices", (req, res) => {
  const rows = all(
    `SELECT p1.* FROM prices p1
     INNER JOIN (
       SELECT coin_id, MAX(fetched_at) AS max_fetched
       FROM prices GROUP BY coin_id
     ) p2 ON p1.coin_id = p2.coin_id AND p1.fetched_at = p2.max_fetched
     ORDER BY market_cap DESC`
  );
  res.json({ ok: true, count: rows.length, data: rows });
});

// ── GET /api/correlations ─────────────────────────────────────
app.get("/api/correlations", (req, res) => {
  const { prediction } = req.query;
  let sql    = `SELECT c1.* FROM correlations c1
    INNER JOIN (
      SELECT coin_id, MAX(calculated_at) AS max_calc
      FROM correlations GROUP BY coin_id
    ) c2 ON c1.coin_id = c2.coin_id AND c1.calculated_at = c2.max_calc`;
  const params = [];
  if (prediction) { sql += " WHERE c1.prediction = ?"; params.push(prediction.toUpperCase()); }
  sql += " ORDER BY ABS(c1.correlation_score) DESC LIMIT 50";
  const rows = all(sql, params);
  res.json({ ok: true, count: rows.length, data: rows });
});

// ── GET /api/report ───────────────────────────────────────────
app.get("/api/report", (req, res) => {
  const type = req.query.type || "summary";
  const row  = get(
    `SELECT * FROM reports WHERE report_type = ? ORDER BY generated_at DESC LIMIT 1`,
    [type]
  );
  if (!row) return res.json({ ok: true, data: null, message: "No report yet. Trigger the pipeline." });
  try { row.key_insights = JSON.parse(row.key_insights || "[]"); } catch { row.key_insights = []; }
  res.json({ ok: true, data: row });
});

// ── GET /api/stats ────────────────────────────────────────────
app.get("/api/stats", (req, res) => {
  res.json({
    ok: true,
    data: {
      total_posts:     get("SELECT COUNT(*) AS n FROM posts")?.n || 0,
      total_sentiment: get("SELECT COUNT(*) AS n FROM sentiment")?.n || 0,
      active_trends:   get("SELECT COUNT(*) AS n FROM trends WHERE detected_at >= datetime('now', '-24 hours')")?.n || 0,
      coins_tracked:   get("SELECT COUNT(DISTINCT coin_id) AS n FROM prices")?.n || 0,
      last_report_at:  get("SELECT generated_at FROM reports ORDER BY generated_at DESC LIMIT 1")?.generated_at || null,
      last_post_at:    get("SELECT fetched_at FROM posts ORDER BY fetched_at DESC LIMIT 1")?.fetched_at || null,
    },
  });
});

// ── POST /api/trigger ─────────────────────────────────────────
app.post("/api/trigger", (req, res) => {
  if (pipelineRunning) {
    return res.status(200).json({ ok: false, message: "Pipeline already running.", running: true });
  }
  const agentNum = req.body?.agent || null;
  triggerPipeline(agentNum);
  res.json({
    ok: true,
    message: agentNum ? `Agent ${agentNum} triggered` : "Full pipeline triggered",
    started_at: new Date().toISOString(),
  });
});

// ── GET /api/trigger/status ───────────────────────────────────
app.get("/api/trigger/status", (req, res) => {
  res.json({ ok: true, running: pipelineRunning, last_run_at: lastRunAt, last_run_status: lastRunStatus });
});

// ── GET /api/health ───────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "trend-analyzer-backend", timestamp: new Date().toISOString(), pipeline_running: pipelineRunning });
});

// ── 404 ───────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `Not found: ${req.method} ${req.path}` }));

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`  Trend Analyzer Backend — port ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/api/health`);
  console.log(`${"=".repeat(50)}\n`);
});
