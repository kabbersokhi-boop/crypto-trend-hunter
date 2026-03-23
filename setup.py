#!/usr/bin/env python3
"""
setup.py — Run this once before anything else.
Checks environment and initialises the database.

Usage: python setup.py
"""

import sys
import os
import subprocess
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent

GREEN  = "\033[92m"
RED    = "\033[91m"
YELLOW = "\033[93m"
RESET  = "\033[0m"

def ok(m):   print(f"{GREEN}  ✓ {m}{RESET}")
def err(m):  print(f"{RED}  ✗ {m}{RESET}")
def warn(m): print(f"{YELLOW}  ! {m}{RESET}")
def head(m): print(f"\n{m}\n{'─'*50}")


head("Python")
v = sys.version_info
if v.major == 3 and v.minor >= 11:
    ok(f"Python {v.major}.{v.minor}.{v.micro}")
else:
    warn(f"Python {v.major}.{v.minor} — recommend 3.11+")


head("Folders")
for d in ["agents", "backend", "database", "frontend", "n8n"]:
    path = BASE_DIR / d
    path.mkdir(exist_ok=True)
    ok(f"/{d}/")


head("Environment Variables")
for var, desc in [
    ("OPENAI_API_KEY", "Required by all agents"),
]:
    val = os.environ.get(var, "")
    if val:
        ok(f"{var} set")
    else:
        err(f"{var} NOT SET — {desc}")
        warn("Add to ~/.bashrc:  export OPENAI_API_KEY=your_key_here")


head("Python Packages")
for pkg in ["openai", "requests", "flask", "flask_cors"]:
    try:
        __import__(pkg)
        ok(pkg)
    except ImportError:
        err(f"{pkg} missing — run: pip install openai requests flask flask-cors --break-system-packages")


head("Node.js")
for cmd in [["node", "--version"], ["npm", "--version"]]:
    try:
        r = subprocess.run(cmd, capture_output=True, text=True)
        ok(f"{cmd[0]} {r.stdout.strip()}")
    except FileNotFoundError:
        err(f"{cmd[0]} not found — run: sudo pacman -S nodejs npm")


head("Database")
db_dir  = BASE_DIR / "database"
db_path = db_dir / "trends.db"
schema  = db_dir / "schema.sql"
db_dir.mkdir(exist_ok=True)
if not schema.exists():
    err(f"schema.sql not found at {schema}")
else:
    os.environ.setdefault("DB_PATH", str(db_path))
    sys.path.insert(0, str(BASE_DIR / "agents"))
    try:
        from database import init_db
        init_db()
        ok(f"Database ready at {db_path}")
    except Exception as e:
        err(f"Database init failed: {e}")


print(f"\n{'='*50}")
print("  Setup complete. Fix any ✗ items above.")
print(f"{'='*50}\n")
