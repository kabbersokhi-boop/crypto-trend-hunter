import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip, Legend, Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

function SentimentGauge({ value }) {
  const angle  = ((value + 1) / 2) * 180 - 90;
  const color  = value >= 0.2 ? '#00ff88' : value <= -0.2 ? '#ff3366' : '#ffcc00';
  const label  = value >= 0.3 ? 'BULLISH' : value <= -0.3 ? 'BEARISH' : 'MIXED';
  const rad    = (a) => (a - 90) * Math.PI / 180;
  const nx     = 100 + 62 * Math.cos(rad(angle));
  const ny     = 100 + 62 * Math.sin(rad(angle));
  return (
    <div style={{ textAlign: 'center', padding: '12px 0' }}>
      <svg viewBox="0 0 200 115" style={{ width: 170 }}>
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="#2a2a38" strokeWidth="10" strokeLinecap="round"/>
        <line x1="100" y1="100" x2={nx} y2={ny} stroke={color} strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="100" cy="100" r="5" fill={color}/>
        <text x="16" y="114" fill="#ff3366" fontSize="8" fontFamily="JetBrains Mono">BEAR</text>
        <text x="154" y="114" fill="#00ff88" fontSize="8" fontFamily="JetBrains Mono">BULL</text>
      </svg>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color }}>
        {value >= 0 ? '+' : ''}{value.toFixed(3)}
      </div>
      <div style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-muted)', marginTop: 3 }}>{label}</div>
    </div>
  );
}

export default function SentimentPage() {
  const [sentiment, setSentiment]     = useState([]);
  const [history, setHistory]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const res = await axios.get('/api/sentiment?hours=24');
        const data = res.data.data || [];
        if (!cancelled) {
          setSentiment(data);
          if (data.length > 0 && !selected) setSelected(data[0].topic);
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    const t = setInterval(fetch, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selected) return;
    axios.get(`/api/sentiment/history?topic=${encodeURIComponent(selected)}&hours=48`)
      .then(r => setHistory(r.data.data || []))
      .catch(console.error);
  }, [selected]);

  const overall = sentiment.length
    ? sentiment.reduce((s, t) => s + t.avg_sentiment * t.mention_count, 0) /
      sentiment.reduce((s, t) => s + t.mention_count, 0)
    : 0;

  const lineData = {
    labels: history.map(h => h.hour?.slice(11, 16) || ''),
    datasets: [{
      label: selected || '',
      data: history.map(h => h.avg_sentiment),
      borderColor: '#00ff88',
      backgroundColor: 'rgba(0,255,136,0.05)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#00ff88',
      tension: 0.4, fill: true,
    }],
  };

  const lineOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { backgroundColor: '#1a1a24', borderColor: '#3a3a50', borderWidth: 1, titleColor: '#e8e8f0', bodyColor: '#8888a8' },
    },
    scales: {
      x: { ticks: { color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#2a2a38' } },
      y: { min: -1, max: 1, ticks: { color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#2a2a38' } },
    },
  };

  if (loading) return <div className="loading-state"><div className="dots"><span/><span/><span/></div><div>Loading sentiment...</div></div>;

  if (!sentiment.length) return (
    <div className="empty-state">
      <div className="empty-icon">🧠</div>
      <div>No sentiment data yet.</div>
      <div style={{ fontSize: 11, marginTop: 6 }}>Run the pipeline to analyse posts.</div>
    </div>
  );

  return (
    <div>
      <div className="page-title">Sentiment Analysis</div>
      <div className="page-subtitle">Market mood across tracked topics — last 24h</div>

      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 14, marginBottom: 14 }}>
        {/* Gauge */}
        <div className="card" style={{ textAlign: 'center' }}>
          <div className="card-title">Overall Mood</div>
          <SentimentGauge value={overall} />
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            {sentiment.reduce((s, t) => s + t.mention_count, 0)} posts
          </div>
        </div>

        {/* Line chart */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Sentiment Over Time</div>
            <select
              value={selected || ''}
              onChange={e => setSelected(e.target.value)}
              style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
            >
              {sentiment.map(t => <option key={t.topic} value={t.topic}>{t.topic}</option>)}
            </select>
          </div>
          <div style={{ height: 210 }}>
            {history.length > 0
              ? <Line data={lineData} options={lineOptions} />
              : <div className="empty-state" style={{ padding: 30 }}>No history for this topic yet.</div>
            }
          </div>
        </div>
      </div>

      {/* Topic cards */}
      <div className="card">
        <div className="card-title">Topic Breakdown</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
          {sentiment.map(t => {
            const pct   = ((t.avg_sentiment + 1) / 2) * 100;
            const color = t.avg_sentiment >= 0.2 ? '#00ff88' : t.avg_sentiment <= -0.2 ? '#ff3366' : '#ffcc00';
            return (
              <div key={t.topic} onClick={() => setSelected(t.topic)} style={{
                padding: '11px 13px', borderRadius: 8, cursor: 'pointer', transition: 'all .15s',
                border: `1px solid ${selected === t.topic ? 'var(--border-bright)' : 'var(--border)'}`,
                background: selected === t.topic ? 'var(--bg-raised)' : 'transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontWeight: 500, fontSize: 13 }}>{t.topic}</span>
                  <span style={{ color, fontWeight: 700, fontSize: 13 }}>{t.avg_sentiment >= 0 ? '+' : ''}{t.avg_sentiment.toFixed(2)}</span>
                </div>
                <div style={{ height: 3, background: 'var(--bg-raised)', borderRadius: 2, marginBottom: 8, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }}/>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--text-muted)' }}>
                  <span>📊 {t.mention_count}</span>
                  <span style={{ color: '#00ff88' }}>▲ {t.positive_count}</span>
                  <span style={{ color: '#ff3366' }}>▼ {t.negative_count}</span>
                  <span>— {t.neutral_count}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
