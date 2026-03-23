"""
database.py — Shared SQLite helper used by all 3 agents.
"""

import sqlite3
import os
import json
from pathlib import Path

BASE_DIR    = Path(__file__).resolve().parent.parent
DB_PATH     = os.environ.get("DB_PATH", str(BASE_DIR / "database" / "trends.db"))
SCHEMA_PATH = str(BASE_DIR / "database" / "schema.sql")


def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    if not os.path.exists(SCHEMA_PATH):
        raise FileNotFoundError(f"Schema not found at {SCHEMA_PATH}")
    with get_connection() as conn:
        with open(SCHEMA_PATH) as f:
            conn.executescript(f.read())
    print(f"[DB] Initialised at {DB_PATH}")


# ── Posts ─────────────────────────────────────────────────────

def insert_posts(posts):
    sql = """
        INSERT OR IGNORE INTO posts
            (id, subreddit, title, content, score, num_comments, url, author, created_at)
        VALUES
            (:id, :subreddit, :title, :content, :score, :num_comments, :url, :author, :created_at)
    """
    with get_connection() as conn:
        conn.executemany(sql, posts)
    print(f"[DB] Inserted {len(posts)} posts")


def get_unanalysed_posts(limit=100):
    sql = """
        SELECT p.* FROM posts p
        LEFT JOIN sentiment s ON s.post_id = p.id
        WHERE s.id IS NULL
        ORDER BY p.fetched_at DESC
        LIMIT ?
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql, (limit,)).fetchall()]


def get_recent_posts(hours=24, limit=500):
    sql = """
        SELECT * FROM posts
        WHERE fetched_at >= datetime('now', ?)
        ORDER BY score DESC LIMIT ?
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql, (f"-{hours} hours", limit)).fetchall()]


# ── Sentiment ─────────────────────────────────────────────────

def insert_sentiment(records):
    sql = """
        INSERT INTO sentiment
            (post_id, topic, sentiment_score, sentiment_label, confidence)
        VALUES
            (:post_id, :topic, :sentiment_score, :sentiment_label, :confidence)
    """
    with get_connection() as conn:
        conn.executemany(sql, records)
    print(f"[DB] Inserted {len(records)} sentiment records")


def get_all_sentiment_summary(hours=24):
    sql = """
        SELECT
            topic,
            COUNT(*) as mention_count,
            AVG(sentiment_score) as avg_sentiment,
            SUM(CASE WHEN sentiment_label='positive' THEN 1 ELSE 0 END) as positive_count,
            SUM(CASE WHEN sentiment_label='negative' THEN 1 ELSE 0 END) as negative_count,
            SUM(CASE WHEN sentiment_label='neutral'  THEN 1 ELSE 0 END) as neutral_count,
            MAX(analysed_at) as last_seen
        FROM sentiment
        WHERE analysed_at >= datetime('now', ?)
        GROUP BY topic
        ORDER BY mention_count DESC
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql, (f"-{hours} hours",)).fetchall()]


def get_sentiment_by_topic(topic, hours=48):
    sql = """
        SELECT s.*, p.title, p.subreddit, p.score as post_score
        FROM sentiment s
        JOIN posts p ON p.id = s.post_id
        WHERE s.topic = ? AND s.analysed_at >= datetime('now', ?)
        ORDER BY s.analysed_at DESC
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql, (topic, f"-{hours} hours")).fetchall()]


# ── Trends ────────────────────────────────────────────────────

def insert_trend(record):
    sql = """
        INSERT INTO trends
            (topic, mention_count, momentum_score, avg_sentiment, related_coins)
        VALUES
            (:topic, :mention_count, :momentum_score, :avg_sentiment, :related_coins)
    """
    with get_connection() as conn:
        conn.execute(sql, record)
    print(f"[DB] Inserted trend: {record['topic']}")


def get_top_trends(limit=10, hours=24):
    sql = """
        SELECT * FROM trends
        WHERE detected_at >= datetime('now', ?)
        ORDER BY momentum_score DESC
        LIMIT ?
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql, (f"-{hours} hours", limit)).fetchall()]


# ── Prices ────────────────────────────────────────────────────

def insert_prices(prices):
    sql = """
        INSERT INTO prices
            (coin_id, coin_name, coin_symbol, price_usd,
             price_change_24h, price_change_7d, volume_24h, market_cap)
        VALUES
            (:coin_id, :coin_name, :coin_symbol, :price_usd,
             :price_change_24h, :price_change_7d, :volume_24h, :market_cap)
    """
    with get_connection() as conn:
        conn.executemany(sql, prices)
    print(f"[DB] Inserted {len(prices)} price records")


def get_latest_prices():
    sql = """
        SELECT p1.* FROM prices p1
        INNER JOIN (
            SELECT coin_id, MAX(fetched_at) as max_fetched
            FROM prices GROUP BY coin_id
        ) p2 ON p1.coin_id = p2.coin_id AND p1.fetched_at = p2.max_fetched
        ORDER BY market_cap DESC
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql).fetchall()]


# ── Correlations ──────────────────────────────────────────────

def upsert_correlation(record):
    with get_connection() as conn:
        conn.execute("DELETE FROM correlations WHERE coin_id = :coin_id", record)
        conn.execute("""
            INSERT INTO correlations
                (coin_id, coin_name, reddit_mentions, avg_sentiment,
                 price_change_24h, correlation_score, prediction)
            VALUES
                (:coin_id, :coin_name, :reddit_mentions, :avg_sentiment,
                 :price_change_24h, :correlation_score, :prediction)
        """, record)


def get_correlations(limit=20):
    sql = """
        SELECT c1.* FROM correlations c1
        INNER JOIN (
            SELECT coin_id, MAX(calculated_at) as max_calc
            FROM correlations GROUP BY coin_id
        ) c2 ON c1.coin_id = c2.coin_id AND c1.calculated_at = c2.max_calc
        ORDER BY ABS(c1.correlation_score) DESC
        LIMIT ?
    """
    with get_connection() as conn:
        return [dict(r) for r in conn.execute(sql, (limit,)).fetchall()]


# ── Reports ───────────────────────────────────────────────────

def insert_report(report_type, content, key_insights, coins_mentioned):
    with get_connection() as conn:
        conn.execute("""
            INSERT INTO reports (report_type, content, key_insights, coins_mentioned)
            VALUES (?, ?, ?, ?)
        """, (report_type, content, json.dumps(key_insights), ",".join(coins_mentioned)))
    print(f"[DB] Inserted {report_type} report")


def get_latest_report(report_type="summary"):
    with get_connection() as conn:
        row = conn.execute("""
            SELECT * FROM reports WHERE report_type = ?
            ORDER BY generated_at DESC LIMIT 1
        """, (report_type,)).fetchone()
    if not row:
        return None
    result = dict(row)
    try:
        result["key_insights"] = json.loads(result.get("key_insights") or "[]")
    except Exception:
        result["key_insights"] = []
    return result


if __name__ == "__main__":
    init_db()
    print(f"[DB] Ready. Path: {DB_PATH}")
