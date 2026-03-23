-- ============================================================
-- Trend Analyzer — SQLite Schema
-- ============================================================

CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    subreddit TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    score INTEGER DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    url TEXT DEFAULT '',
    author TEXT DEFAULT '',
    created_at TIMESTAMP,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sentiment (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id TEXT NOT NULL,
    topic TEXT NOT NULL,
    sentiment_score REAL CHECK(sentiment_score BETWEEN -1.0 AND 1.0),
    sentiment_label TEXT CHECK(sentiment_label IN ('positive', 'negative', 'neutral')),
    confidence REAL DEFAULT 0.0,
    analysed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id)
);

CREATE TABLE IF NOT EXISTS trends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    mention_count INTEGER DEFAULT 0,
    momentum_score REAL DEFAULT 0.0,
    avg_sentiment REAL DEFAULT 0.0,
    related_coins TEXT DEFAULT '',
    detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT NOT NULL,
    coin_name TEXT NOT NULL,
    coin_symbol TEXT DEFAULT '',
    price_usd REAL NOT NULL,
    price_change_24h REAL DEFAULT 0.0,
    price_change_7d REAL DEFAULT 0.0,
    volume_24h REAL DEFAULT 0.0,
    market_cap REAL DEFAULT 0.0,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS correlations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    coin_id TEXT NOT NULL,
    coin_name TEXT NOT NULL,
    reddit_mentions INTEGER DEFAULT 0,
    avg_sentiment REAL DEFAULT 0.0,
    price_change_24h REAL DEFAULT 0.0,
    correlation_score REAL DEFAULT 0.0,
    prediction TEXT CHECK(prediction IN ('HOT', 'COOLING', 'NEUTRAL')),
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type TEXT CHECK(report_type IN ('sentiment', 'trend', 'memecoin', 'summary')),
    content TEXT NOT NULL,
    key_insights TEXT DEFAULT '[]',
    coins_mentioned TEXT DEFAULT '',
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_posts_subreddit  ON posts(subreddit);
CREATE INDEX IF NOT EXISTS idx_posts_created    ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_sentiment_post   ON sentiment(post_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_topic  ON sentiment(topic);
CREATE INDEX IF NOT EXISTS idx_trends_detected  ON trends(detected_at);
CREATE INDEX IF NOT EXISTS idx_prices_coin      ON prices(coin_id);
CREATE INDEX IF NOT EXISTS idx_prices_fetched   ON prices(fetched_at);
CREATE INDEX IF NOT EXISTS idx_correlations_coin ON correlations(coin_id);
