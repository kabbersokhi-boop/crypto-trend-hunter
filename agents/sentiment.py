"""
sentiment.py — Agent 1: Sentiment Analyser
Reads unanalysed posts, scores sentiment via GPT-4o-mini, writes to DB.

Usage:
    python sentiment.py
    python sentiment.py --limit 50
"""

import os
import sys
import json
import argparse
from openai import OpenAI

sys.path.insert(0, os.path.dirname(__file__))
from database import get_unanalysed_posts, insert_sentiment, init_db

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
MODEL  = "gpt-4o-mini"

SYSTEM_PROMPT = """
You are a financial sentiment analyst specialising in crypto and retail trading.

Given a Reddit post, return ONLY valid JSON — no markdown, no explanation:
{
  "topic": "main topic (coin name, ticker, or theme — 1-3 words)",
  "sentiment_score": float between -1.0 (very bearish) and 1.0 (very bullish),
  "sentiment_label": "positive" or "negative" or "neutral",
  "confidence": float between 0.0 and 1.0
}

Rules:
- Focus on financial/investment sentiment not general emotion
- Hype and moon talk = positive
- FUD, losses, warnings = negative
- News without clear direction = neutral
- Pick the single most prominent topic
""".strip()


def analyse_post(post):
    text = f"Subreddit: r/{post['subreddit']}\nTitle: {post['title']}\nContent: {(post.get('content') or '')[:500]}"
    try:
        response = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user",   "content": text},
            ],
            temperature=0.1,
            max_tokens=150,
            response_format={"type": "json_object"},
        )
        result = json.loads(response.choices[0].message.content)
        return {
            "post_id":         post["id"],
            "topic":           str(result.get("topic", "unknown"))[:100].lower().strip(),
            "sentiment_score": max(-1.0, min(1.0, float(result.get("sentiment_score", 0.0)))),
            "sentiment_label": result.get("sentiment_label", "neutral") if result.get("sentiment_label") in ("positive","negative","neutral") else "neutral",
            "confidence":      max(0.0, min(1.0, float(result.get("confidence", 0.5)))),
        }
    except Exception as e:
        print(f"[Agent1] Error on post {post['id']}: {e}")
        return None


def run(limit=100):
    print(f"\n[Agent1] Sentiment Analyser — limit={limit}")
    init_db()

    posts = get_unanalysed_posts(limit=limit)
    if not posts:
        print("[Agent1] No unanalysed posts.")
        return []

    print(f"[Agent1] {len(posts)} posts to analyse")
    results, errors = [], 0

    for i, post in enumerate(posts, 1):
        print(f"[Agent1] {i}/{len(posts)} — {post['title'][:60]}")
        result = analyse_post(post)
        if result:
            results.append(result)
            print(f"         topic={result['topic']}  score={result['sentiment_score']:+.2f}  ({result['sentiment_label']})")
        else:
            errors += 1

    if results:
        insert_sentiment(results)

    print(f"[Agent1] Done — {len(results)} analysed, {errors} errors")
    return results


def run_batch(posts_json):
    """Called by Node.js with JSON string of posts."""
    posts = json.loads(posts_json)
    results = [r for p in posts if (r := analyse_post(p))]
    if results:
        insert_sentiment(results)
    print(json.dumps(results))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100)
    parser.add_argument("--batch", type=str, default=None)
    args = parser.parse_args()
    if args.batch:
        run_batch(args.batch)
    else:
        run(limit=args.limit)
