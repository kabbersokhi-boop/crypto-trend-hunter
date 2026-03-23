"""
trends.py — Agent 2: Trend Detector
Reads sentiment data, calculates momentum, identifies trending topics.

Usage:
    python trends.py
    python trends.py --hours 12
"""

import os
import sys
import json
import argparse
from openai import OpenAI

sys.path.insert(0, os.path.dirname(__file__))
from database import get_all_sentiment_summary, insert_trend, insert_report, init_db

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL  = "gpt-4o-mini"

COIN_PROMPT = """You are a crypto analyst. Given a Reddit trending topic, return ONLY JSON:
{"related_coins": ["coingecko-id-1", "coingecko-id-2"]}
Use CoinGecko IDs (lowercase, hyphenated e.g. "dogecoin", "shiba-inu", "pepe").
Return empty array if topic is not crypto-related."""

SUMMARY_PROMPT = """You are a crypto market analyst. Given trending Reddit topics with sentiment data,
write a market summary. Return ONLY JSON:
{
  "summary": "2-3 sentence market overview",
  "key_insights": ["insight 1", "insight 2", "insight 3"],
  "top_coin_to_watch": "coin-name or null",
  "market_mood": "bullish or bearish or mixed or uncertain"
}"""


def calculate_momentum(topic_data, all_topics):
    """Momentum 0.0–1.0. 70% mention share + 30% sentiment strength."""
    max_mentions = max(t["mention_count"] for t in all_topics) or 1
    mention_ratio      = topic_data["mention_count"] / max_mentions
    sentiment_strength = abs(topic_data["avg_sentiment"])
    return round(min((mention_ratio * 0.7) + (sentiment_strength * 0.3), 1.0), 4)


def extract_related_coins(topic):
    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": COIN_PROMPT},
                {"role": "user",   "content": f"Topic: {topic}"},
            ],
            temperature=0.1,
            max_tokens=100,
            response_format={"type": "json_object"},
        )
        return json.loads(r.choices[0].message.content).get("related_coins", [])
    except Exception as e:
        print(f"[Agent2] Coin extraction error for '{topic}': {e}")
        return []


def generate_summary(trends):
    data = json.dumps([{
        "topic": t["topic"], "mentions": t["mention_count"],
        "sentiment": round(t["avg_sentiment"], 2),
        "momentum": round(t["momentum_score"], 2),
    } for t in trends[:10]], indent=2)
    try:
        r = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SUMMARY_PROMPT},
                {"role": "user",   "content": f"Trending topics:\n{data}"},
            ],
            temperature=0.3,
            max_tokens=400,
            response_format={"type": "json_object"},
        )
        return json.loads(r.choices[0].message.content)
    except Exception as e:
        print(f"[Agent2] Summary error: {e}")
        return {"summary": "Unavailable.", "key_insights": [], "top_coin_to_watch": None, "market_mood": "uncertain"}


def run(hours=24, min_mentions=2):
    print(f"\n[Agent2] Trend Detector — lookback={hours}h  min_mentions={min_mentions}")
    init_db()

    summary = get_all_sentiment_summary(hours=hours)
    if not summary:
        print("[Agent2] No sentiment data. Run Agent 1 first.")
        return []

    eligible = [t for t in summary if t["mention_count"] >= min_mentions]
    print(f"[Agent2] {len(eligible)}/{len(summary)} topics qualify")

    if not eligible:
        print("[Agent2] Not enough data yet.")
        return []

    detected = []
    for td in eligible:
        momentum = calculate_momentum(td, eligible)
        coins    = extract_related_coins(td["topic"])
        trend = {
            "topic":          td["topic"],
            "mention_count":  td["mention_count"],
            "momentum_score": momentum,
            "avg_sentiment":  round(td["avg_sentiment"], 4),
            "related_coins":  ",".join(coins),
        }
        insert_trend(trend)
        detected.append(trend)
        print(f"[Agent2] {trend['topic']:<30} momentum={momentum:.3f}  sentiment={trend['avg_sentiment']:+.2f}  coins={coins}")

    detected.sort(key=lambda x: x["momentum_score"], reverse=True)

    print("\n[Agent2] Generating summary report...")
    s = generate_summary(detected)
    insert_report(
        report_type="trend",
        content=s.get("summary", ""),
        key_insights=s.get("key_insights", []),
        coins_mentioned=[c for c in [s.get("top_coin_to_watch")] if c],
    )
    print(f"[Agent2] Mood: {s.get('market_mood','?').upper()}  Top coin: {s.get('top_coin_to_watch','none')}")
    print(f"[Agent2] Done — {len(detected)} trends written")
    return detected


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours",        type=int, default=24)
    parser.add_argument("--min-mentions", type=int, default=2)
    args = parser.parse_args()
    run(hours=args.hours, min_mentions=args.min_mentions)
