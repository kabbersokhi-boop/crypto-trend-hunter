"""
run_pipeline.py — Runs all 3 agents in sequence.
Called by Node.js backend. Also runnable manually.

Usage:
    python run_pipeline.py
    python run_pipeline.py --agent 1
    python run_pipeline.py --agent 2
    python run_pipeline.py --agent 3
"""

import sys
import os
import time
import argparse
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))


def run_all():
    from database import init_db
    init_db()

    start = time.time()
    print(f"\n{'#'*50}")
    print(f"  PIPELINE START  [{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}]")
    print(f"{'#'*50}")

    results = {}

    try:
        from sentiment import run
        results["sentiment"] = run()
    except Exception as e:
        print(f"[Pipeline] Agent 1 failed: {e}")
        results["sentiment"] = []

    try:
        from trends import run
        results["trends"] = run()
    except Exception as e:
        print(f"[Pipeline] Agent 2 failed: {e}")
        results["trends"] = []

    try:
        from memecoin import run
        results["correlations"] = run()
    except Exception as e:
        print(f"[Pipeline] Agent 3 failed: {e}")
        results["correlations"] = []

    elapsed = round(time.time() - start, 1)
    print(f"\n{'#'*50}")
    print(f"  PIPELINE DONE in {elapsed}s  [{datetime.now().strftime('%H:%M:%S')}]")
    print(f"{'#'*50}\n")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--agent", type=int, choices=[1, 2, 3])
    args = parser.parse_args()

    sys.path.insert(0, os.path.dirname(__file__))
    from database import init_db
    init_db()

    if args.agent == 1:
        from sentiment import run; run()
    elif args.agent == 2:
        from trends import run; run()
    elif args.agent == 3:
        from memecoin import run; run()
    else:
        run_all()
