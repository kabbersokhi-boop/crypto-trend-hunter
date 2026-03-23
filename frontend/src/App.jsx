import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import TrendsPage    from './pages/Trends';
import SentimentPage from './pages/Sentiment';
import MemecoinsPage from './pages/Memecoins';
import ReportPage    from './pages/Report';

const POLL = 5 * 60 * 1000; // 5 minutes

export default function App() {
  const [page, setPage]           = useState('trends');
  const [stats, setStats]         = useState(null);
  const [pipeline, setPipeline]   = useState({ running: false, last_run_at: null, last_run_status: 'never' });
  const [triggering, setTriggering] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchStats = useCallback(async () => {
    try {
      const [s, p] = await Promise.all([
        axios.get('/api/stats'),
        axios.get('/api/trigger/status'),
      ]);
      setStats(s.data.data);
      setPipeline(p.data);
      setLastRefresh(new Date());
    } catch (e) {
      console.error('Stats fetch failed:', e);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, POLL);
    return () => clearInterval(t);
  }, [fetchStats]);

  const triggerPipeline = async () => {
    if (triggering || pipeline.running) return;
    setTriggering(true);
    try {
      await axios.post('/api/trigger');
      setPipeline(p => ({ ...p, running: true, last_run_status: 'running' }));
      const poll = setInterval(async () => {
        const res = await axios.get('/api/trigger/status');
        setPipeline(res.data);
        if (!res.data.running) {
          clearInterval(poll);
          setTriggering(false);
          fetchStats();
        }
      }, 3000);
    } catch (e) {
      console.error('Trigger failed:', e);
      setTriggering(false);
    }
  };

  const nav = [
    { id: 'trends',    label: 'Trending',  icon: '📈' },
    { id: 'sentiment', label: 'Sentiment', icon: '🧠' },
    { id: 'memecoins', label: 'Memecoins', icon: '🔥' },
    { id: 'report',    label: 'AI Report', icon: '📋' },
  ];

  const busy = triggering || pipeline.running;

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">TrendAnalyzer</span>
          </div>
          {stats && (
            <div style={{ display:'flex', gap:'6px' }}>
              <span className="stat-pill">{stats.total_posts?.toLocaleString()} posts</span>
              <span className="stat-pill">{stats.active_trends} trends</span>
              <span className="stat-pill">{stats.coins_tracked} coins</span>
            </div>
          )}
        </div>
        <div className="header-right">
          {lastRefresh && (
            <span className="last-refresh">Updated {lastRefresh.toLocaleTimeString()}</span>
          )}
          <button
            className={`trigger-btn ${busy ? 'running' : ''}`}
            onClick={triggerPipeline}
            disabled={busy}
          >
            {busy
              ? <><span className="spinner" /> Running...</>
              : <>▶ Run Pipeline</>
            }
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="app-nav">
        {nav.map(n => (
          <button
            key={n.id}
            className={`nav-btn ${page === n.id ? 'active' : ''}`}
            onClick={() => setPage(n.id)}
          >
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </button>
        ))}
      </nav>

      {/* Pages */}
      <main className="app-main">
        {page === 'trends'    && <TrendsPage />}
        {page === 'sentiment' && <SentimentPage />}
        {page === 'memecoins' && <MemecoinsPage />}
        {page === 'report'    && <ReportPage onTrigger={triggerPipeline} pipeline={pipeline} />}
      </main>
    </div>
  );
}
