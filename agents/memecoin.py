"""
memecoin.py — Agent 3: Memecoin Correlator
Fetches CoinGecko prices, correlates Reddit sentiment with price movement,
labels each coin HOT/COOLING/NEUTRAL, generates AI market report.

Usage:
    python memecoin.py
    python memecoin.py --top 20
"""

import os
import sys
import json
import time
import argparse
import requests
from openai import OpenAI

sys.path.insert(0, os.path.dirname(__file__))
from database import (
    get_top_trends, get_latest_prices, insert_prices,
    upsert_correlation, get_correlations, insert_report, init_db,
)

client         = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL          = "gpt-4o-mini"
COINGECKO_BASE = "https://api.coingecko.com/api/v3"

REPORT_PROMPT = """You are a crypto market intelligence analyst.
Given coin correlation data (Reddit sentiment vs price movements), write a report.

Return ONLY JSON:
{
  "summary": "3-4 sentence executive summary of the current memecoin market",
  "key_insights": [
    "Specific insight about a HOT coin",
    "Specific insight about a COOLING coin",
    "Overall market observation",
    "Trading risk or opportunity to watch"
  ],
  "coins_to_watch": ["coin1", "coin2"],
  "risk_level": "low or medium or high",
  "recommendation": "One actionable sentence for a retail trader"
}
Be specific, use the data, avoid generic advice."""


# ── CoinGecko ─────────────────────────────────────────────────

def fetch_top_memecoins(limit=30):
    """Fetch top memecoins by market cap from CoinGecko free API."""
    try:
        response = requests.get(
            f"{COINGECKO_BASE}/coins/markets",
            params={
                "vs_currency": "usd",
                "category":    "meme-token",
                "order":       "market_cap_desc",
                "per_page":    limit,
                "page":        1,
                "price_change_percentage": "24h,7d",
            },
            headers={"User-Agent": "trend-analyzer/1.0"},
            timeout=15,
        )
        response.raise_for_status()
        coins = []
        for c in response.json():
            coins.append({
                "coin_id":          c["id"],
                "coin_name":        c["name"],
                "coin_symbol":      c.get("symbol", "").upper(),
                "price_usd":        float(c.get("current_price") or 0),
                "price_change_24h": float(c.get("price_change_percentage_24h") or 0),
                "price_change_7d":  float(c.get("price_change_percentage_7d_in_currency") or 0),
                "volume_24h":       float(c.get("total_volume") or 0),
                "market_cap":       float(c.get("market_cap") or 0),
            })
        print(f"[Agent3] Fetched {len(coins)} memecoins from CoinGecko")
        return coins
    except requests.exceptions.HTTPError as e:
        if e.response is not None and e.response.status_code == 429:
            print("[Agent3] CoinGecko rate limit — waiting 60s...")
            time.sleep(60)
            return fetch_top_memecoins(limit)
        print(f"[Agent3] CoinGecko HTTP error: {e}")
        return []
    except Exception as e:
        print(f"[Agent3] CoinGecko error: {e}")
        return []


def fetch_coins_by_ids(coin_ids):
    """Fetch prices for specific coin IDs."""
    if not coin_ids:
        return []
    try:
        response = requests.get(
            f"{COINGECKO_BASE}/coins/markets",
            params={
                "vs_currency": "usd",
                "ids":         ",".join(coin_ids),
                "order":       "market_cap_desc",
                "per_page":    50,
                "page":        1,
                "price_change_percentage": "24h,7d",
            },
            headers={"User-Agent": "trend-analyzer/1.0"},
            timeout=15,
        )
        response.raise_for_status()
        coins = []
        for c in response.json():
            coins.append({
                "coin_id":          c["id"],
                "coin_name":        c["name"],
                "coin_symbol":      c.get("symbol", "").upper(),
                "price_usd":        float(c.get("current_price") or 0),
                "price_change_24h": float(c.get("price_change_percentage_24h") or 0),
                "price_change_7d":  float(c.get("price_change_percentage_7d_in_currency") or 0),
                "volume_24h":       float(c.get("total_volume") or 0),
                "market_cap":       float(c.get("market_cap") or 0),
            })
        return coins
    except Exception as e:
        print(f"[Agent3] fetch_coins_by_ids error: {e}")
        return []


# ── Correlation logic ─────────────────────────────────────────

def calculate_correlation_score(avg_sentiment, price_change_24h, reddit_mentions):
    price_norm    = max(-1.0, min(1.0, price_change_24h / 50.0))
    correlation   = avg_sentiment * price_norm
    mention_boost = min(reddit_mentions / 100.0, 0.2)
    return round(max(-1.0, min(1.0, correlation + mention_boost)), 4)


def predict_coin_status(avg_sentiment, price_change_24h, correlation_score):
    if avg_sentiment > 0.2 and (price_change_24h > 5 or correlation_score > 0.3):
        return "HOT"
    if avg_sentiment < -0.1 or (price_change_24h < -10 and correlation_score < 0):
        return "COOLING"
    return "NEUTRAL"


# ── AI report ─────────────────────────────────────────────────

def generate_final_report(correlations):
    data = json.dumps([{
        "coin":        c["coin_name"],
        "prediction":  c["prediction"],
        "sentiment":   round(c["avg_sentiment"], 2),
        "price_24h":   round(c["price_change_24h"], 2),
        "mentions":    c["reddit_mentions"],
        "correlation": round(c["correlation_score"], 2),
    } for c in correlations[:15]], indent=2)
    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": REPORT_PROMPT},
                {"role": "user",   "content": f"Correlation data:\n{data}"},
            ],
            temperature=0.4,
            max_tokens=600,
            response_format={"type": "json_object"},
        )
        return json.loads(r.choices[0].message.content)
    except Exception as e:
        print(f"[Agent3] Report error: {e}")
        return {
            "summary": "Report generation failed.",
            "key_insights": [], "coins_to_watch": [],
            "risk_level": "unknown", "recommendation": "Check logs.",
        }


# ── Main ──────────────────────────────────────────────────────

def run(top=20):
    print(f"\n[Agent3] Memecoin Correlator — top={top}")
    init_db()

    # Step 1: fetch top memecoins
    prices = fetch_top_memecoins(limit=top)

    # Step 2: also fetch any coins mentioned in trends
    trends = get_top_trends(limit=50)
    extra_ids = set()
    for t in trends:
        for cid in (t.get("related_coins") or "").split(","):
            cid = cid.strip()
            if cid:
                extra_ids.add(cid)
    known_ids = {p["coin_id"] for p in prices}
    missing   = extra_ids - known_ids
    if missing:
        extra = fetch_coins_by_ids(list(missing))
        prices.extend(extra)

    if not prices:
        prices = get_latest_prices()
        print(f"[Agent3] Using {len(prices)} cached prices from DB")

    if not prices:
        print("[Agent3] No price data. Check CoinGecko connectivity.")
        return []

    insert_prices(prices)
    price_map = {p["coin_id"]: p for p in prices}

    # Step 3: build sentiment per coin from trends
    coin_sentiment = {}
    coin_mentions  = {}
    for t in trends:
        for cid in (t.get("related_coins") or "").split(","):
            cid = cid.strip()
            if not cid:
                continue
            coin_sentiment.setdefault(cid, []).append(t["avg_sentiment"])
            coin_mentions[cid] = coin_mentions.get(cid, 0) + t["mention_count"]

    # Step 4: calculate correlations for every coin
    records = []
    for coin_id, price_data in price_map.items():
        sentiments   = coin_sentiment.get(coin_id, [])
        mentions     = coin_mentions.get(coin_id, 0)
        avg_sent     = sum(sentiments) / len(sentiments) if sentiments else 0.0
        price_change = price_data["price_change_24h"]

        corr_score = calculate_correlation_score(avg_sent, price_change, mentions)
        prediction = predict_coin_status(avg_sent, price_change, corr_score)

        record = {
            "coin_id":           coin_id,
            "coin_name":         price_data["coin_name"],
            "reddit_mentions":   mentions,
            "avg_sentiment":     round(avg_sent, 4),
            "price_change_24h":  round(price_change, 4),
            "correlation_score": corr_score,
            "prediction":        prediction,
        }
        upsert_correlation(record)
        records.append(record)

        icon = {"HOT": "🔥", "COOLING": "❄️ ", "NEUTRAL": "➖"}[prediction]
        print(f"[Agent3] {icon} {price_data['coin_name']:<18} sent={avg_sent:+.2f}  Δ24h={price_change:+.1f}%  corr={corr_score:+.2f}")

    # Step 5: generate AI report
    records.sort(key=lambda x: abs(x["correlation_score"]), reverse=True)
    print("\n[Agent3] Generating market intelligence report...")
    report = generate_final_report(records)

    insert_report(
        report_type="summary",
        content=report.get("summary", ""),
        key_insights=report.get("key_insights", []),
        coins_mentioned=report.get("coins_to_watch", []),
    )

    hot     = sum(1 for r in records if r["prediction"] == "HOT")
    cooling = sum(1 for r in records if r["prediction"] == "COOLING")
    print(f"\n[Agent3] 🔥 {hot} HOT  ❄️  {cooling} COOLING")
    print(f"[Agent3] Risk: {report.get('risk_level','?').upper()}")
    print(f"[Agent3] Done — {len(records)} coins analysed")
    return records


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=20)
    args = parser.parse_args()
    run(top=args.top)
