# 🧠 crypto-trend-hunter

> **Autonomous multi-agent AI that watches crypto Reddit 24/7, scores sentiment, tracks live prices, and surfaces HOT signals before the crowd catches on.**

![Python](https://img.shields.io/badge/Python-3.10+-blue?style=flat-square&logo=python)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square&logo=node.js)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![n8n](https://img.shields.io/badge/n8n-automated-orange?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o--mini-412991?style=flat-square&logo=openai)

---

## What This Is
In late 2024, I was deep in the chaos of the memecoin supercycle. OFFICIAL TRUMP launched and within 72 hours had a fully diluted valuation north of $70 billion. I was glued to my screen making a critical mistake: watching only what I already knew about. Tunnel vision on TRUMP. Meanwhile PEPE was staging a 300% recovery. Algorand was trending on r/CryptoCurrency with institutional backing nobody was talking about. BONK was being accumulated by whale wallets while Reddit argued about Trump's next executive order.

I missed three separate 5x opportunities in one week. Not from lack of conviction, from lack of infrastructure. No tool existed that could monitor Reddit sentiment across multiple communities, correlate it with live price data, and surface signals before the crowd caught on.

So I built one.

Every 30 minutes it automatically:
- Scrapes **4 Reddit communities** (r/CryptoMoonShots, r/wallstreetbets, r/Bitcoin, r/CryptoCurrency)
- Pulls **live prices** from CoinGecko for 30+ coins
- Runs a **3-agent AI pipeline** to score sentiment, detect momentum, and correlate signals
- Updates a **React dashboard** with HOT / COOLING / NEUTRAL predictions
- Generates a **fresh GPT-4o-mini market report** from real data

You run one command. Everything else runs itself.

---

## Architecture

```
Reddit (4 subs) ──┐
                  ├──▶ n8n Master Workflow ──▶ Node.js Backend ──▶ SQLite DB
CoinGecko API ───┘                                    │
                                                      ▼
                                          ┌─────────────────────┐
                                          │   Python Pipeline   │
                                          │                     │
                                          │  Agent 1: Sentiment │  ← GPT-4o-mini per post
                                          │  Agent 2: Trends    │  ← momentum scoring
                                          │  Agent 3: Memecoins │  ← price correlation
                                          └─────────────────────┘
                                                      │
                                                      ▼
                                            React Dashboard (4 pages)
```

### The Three Agents

| Agent | Job | How |
|-------|-----|-----|
| **Sentiment Analyser** | Score every Reddit post -1 to +1 | Custom-engineered GPT-4o-mini prompt extracting the tradeable topic + sentiment |
| **Trend Detector** | Surface what's gaining momentum | 70% mention volume + 30% sentiment strength = momentum score |
| **Memecoin Correlator** | Cross Reddit signal with price action | HOT / COOLING / NEUTRAL + AI-generated market report |

---

## Dashboard

Four pages, all live data from your local SQLite DB via a Node.js REST API:

- **Trending** — bar chart of topics by mention volume, colour-coded by sentiment
- **Sentiment** — market mood gauge + per-coin sentiment over time
- **Memecoins** — scatter plot (sentiment vs price change) + coin intelligence table
- **AI Report** — GPT-written executive summary generated fresh every pipeline run

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Use [nvm](https://github.com/nvm-sh/nvm) recommended |
| Python | 3.10+ | |
| n8n | Latest | Installed globally via npm |
| OpenAI API Key | — | GPT-4o-mini access required |

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/kabbersokhi-boop/crypto-trend-hunter.git
cd crypto-trend-hunter
```

### 2. Set your OpenAI API key

```bash
cp .env.example .env
```

Open `.env` and add your key:

```
OPENAI_API_KEY=sk-proj-...
```

### 3. Install dependencies

**Python:**
```bash
pip install -r requirements.txt
```

**Node.js backend:**
```bash
cd backend && npm install && cd ..
```

**React frontend:**
```bash
cd frontend && npm install && cd ..
```

**n8n (if not installed):**
```bash
npm install -g n8n
```

### 4. Set up the database

```bash
python setup.py
```

---

## Running the Project

### macOS / Linux

One command starts everything:

```bash
bash start.sh
```

This opens 3 terminal tabs:
- **Backend** — Node.js API on port 3001
- **Frontend** — React dev server on port 3000
- **n8n** — workflow engine on port 5678

Wait ~15 seconds, then open:
- Dashboard → http://localhost:3000
- n8n → http://localhost:5678

### Windows

Open **3 separate terminals** and run one command in each:

**Terminal 1 — Backend:**
```bash
cd backend
node server.js
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm start
```

**Terminal 3 — n8n:**
```bash
n8n start
```

---

## Importing the n8n Workflow

1. Open http://localhost:5678
2. Click **+** → **Import from file**
3. Select `n8n/master_workflow.json`
4. Click **Execute workflow** to test
5. Toggle **Active** to enable automatic 30-minute runs

---

## Running the Pipeline Manually

Without n8n, you can trigger the full pipeline from the dashboard (top right **Run Pipeline** button) or via terminal:

```bash
curl -X POST http://localhost:3001/api/trigger
```

---

## Project Structure

```
crypto-trend-hunter/
├── agents/
│   ├── sentiment.py        # Agent 1 — GPT-4o-mini sentiment scoring
│   ├── trends.py           # Agent 2 — momentum trend detection
│   ├── memecoin.py         # Agent 3 — price correlation + report generation
│   ├── pipeline.py         # Orchestrates all 3 agents in sequence
│   └── database.py         # Shared DB access layer
├── backend/
│   ├── server.js           # Node.js REST API (11 endpoints)
│   └── db.js               # SQLite connection using node:sqlite
├── database/
│   └── schema.sql          # DB schema
├── frontend/
│   └── src/                # React app — 4 dashboard pages
├── n8n/
│   └── master_workflow.json # Single n8n workflow (Reddit + CoinGecko + trigger)
├── .env.example
├── setup.py                # DB initialisation
├── start.sh                # One-command startup (macOS/Linux)
└── requirements.txt
```

---

## Tech Stack

- **Python** — 3 AI agents + pipeline orchestration
- **Node.js** — REST API backend, SQLite via native `node:sqlite`
- **React + Chart.js** — frontend dashboard
- **SQLite** — lightweight local database, zero config
- **OpenAI GPT-4o-mini** — sentiment scoring + market report generation
- **CoinGecko API** — live crypto prices, no API key needed
- **Reddit public JSON API** — no credentials, no rate limits
- **n8n** — workflow automation, 30-minute scheduled runs

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | ✅ | Your OpenAI API key |
| `PORT` | ❌ | Backend port (default: 3001) |

Copy `.env.example` to `.env` — never commit your `.env` file.

---

## License

MIT
