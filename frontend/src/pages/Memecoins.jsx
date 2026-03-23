import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, LinearScale, PointElement, Tooltip, Legend,
} from 'chart.js';
import { Scatter } from 'react-chartjs-2';

ChartJS.register(LinearScale, PointElement, Tooltip, Legend);

function Badge({ prediction }) {
  const map = {
    HOT:     { cls: 'badge-hot',     icon: '🔥' },
    COOLING: { cls: 'badge-cooling', icon: '❄️' },
    NEUTRAL: { cls: 'badge-neutral', icon: '➖' },
  };
  const p = map[prediction] || map.NEUTRAL;
  return <span className={`badge ${p.cls}`}>{p.icon} {prediction}</span>;
}

function PriceChange({ value }) {
  const color = value > 0 ? '#00ff88' : value < 0 ? '#ff3366' : 'var(--text-secondary)';
  return <span style={{ color, fontWeight: 600 }}>{value > 0 ? '+' : ''}{value.toFixed(2)}%</span>;
}

export default function MemecoinsPage() {
  const [correlations, setCorrelations] = useState([]);
  const [prices, setPrices]             = useState([]);
  const [filter, setFilter]             = useState('ALL');
  const [loading, setLoading]           = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      try {
        const [c, p] = await Promise.all([
          axios.get('/api/correlations'),
          axios.get('/api/prices'),
        ]);
        if (!cancelled) {
          setCorrelations(c.data.data || []);
          setPrices(p.data.data || []);
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
  }, []);

  const filtered = filter === 'ALL' ? correlations : correlations.filter(c => c.prediction === filter);

  const colorMap = { HOT: 'rgba(255,51,102,.8)', COOLING: 'rgba(68,136,255,.8)', NEUTRAL: 'rgba(136,136,168,.5)' };

  const scatterData = {
    datasets: [{
      label: 'Coins',
      data: correlations.map(c => ({ x: c.avg_sentiment, y: c.price_change_24h, name: c.coin_name, pred: c.prediction })),
      backgroundColor: correlations.map(c => colorMap[c.prediction] || colorMap.NEUTRAL),
      pointRadius: 6, pointHoverRadius: 9,
    }],
  };

  const scatterOptions = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a24', borderColor: '#3a3a50', borderWidth: 1,
        titleColor: '#e8e8f0', bodyColor: '#8888a8',
        callbacks: {
          label: ctx => {
            const d = ctx.raw;
            return [`${d.name}`, `Sentiment: ${d.x >= 0 ? '+' : ''}${d.x.toFixed(2)}`, `24h: ${d.y >= 0 ? '+' : ''}${d.y.toFixed(2)}%`, `${d.pred}`];
          },
        },
      },
    },
    scales: {
      x: {
        min: -1, max: 1,
        title: { display: true, text: '← Bearish   Sentiment   Bullish →', color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 } },
        ticks: { color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 } },
        grid:  { color: '#2a2a38' },
      },
      y: {
        title: { display: true, text: 'Price Change 24h (%)', color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 } },
        ticks: { color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 }, callback: v => v + '%' },
        grid:  { color: '#2a2a38' },
      },
    },
  };

  const hot     = correlations.filter(c => c.prediction === 'HOT').length;
  const cooling = correlations.filter(c => c.prediction === 'COOLING').length;
  const neutral = correlations.filter(c => c.prediction === 'NEUTRAL').length;

  if (loading) return <div className="loading-state"><div className="dots"><span/><span/><span/></div><div>Loading memecoin data...</div></div>;

  if (!correlations.length) return (
    <div className="empty-state">
      <div className="empty-icon">🔥</div>
      <div>No memecoin data yet.</div>
      <div style={{ fontSize: 11, marginTop: 6 }}>Run the pipeline to analyse coins.</div>
    </div>
  );

  return (
    <div>
      <div className="page-title">Memecoin Intelligence</div>
      <div className="page-subtitle">Reddit sentiment vs price movement — HOT / COOLING / NEUTRAL</div>

      {/* Summary counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
        {[
          { label: 'HOT',     count: hot,     color: '#ff3366', icon: '🔥' },
          { label: 'COOLING', count: cooling, color: '#4488ff', icon: '❄️' },
          { label: 'NEUTRAL', count: neutral, color: '#8888a8', icon: '➖' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', cursor: 'pointer',
            border: filter === s.label ? `1px solid ${s.color}` : undefined }}
            onClick={() => setFilter(filter === s.label ? 'ALL' : s.label)}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 10, letterSpacing: '2px', color: 'var(--text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
        {/* Scatter */}
        <div className="card">
          <div className="card-title">Sentiment vs Price Change</div>
          <div style={{ height: 250 }}>
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 8, fontSize: 10, color: 'var(--text-muted)' }}>
            <span><span style={{ color: '#ff3366' }}>●</span> HOT</span>
            <span><span style={{ color: '#4488ff' }}>●</span> COOLING</span>
            <span><span style={{ color: '#8888a8' }}>●</span> NEUTRAL</span>
          </div>
        </div>

        {/* Live prices */}
        <div className="card">
          <div className="card-title">Live Prices</div>
          <div style={{ maxHeight: 285, overflowY: 'auto' }}>
            {prices.slice(0, 12).map(p => (
              <div key={p.coin_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{p.coin_name}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 5, fontSize: 10 }}>{p.coin_symbol}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)' }}>
                    ${p.price_usd < 0.01 ? p.price_usd.toExponential(2) : p.price_usd.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 10 }}><PriceChange value={p.price_change_24h} /></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Correlation table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Coin Intelligence</div>
          <div style={{ display: 'flex', gap: 5 }}>
            {['ALL', 'HOT', 'COOLING', 'NEUTRAL'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '3px 9px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: 10,
                border: `1px solid ${filter === f ? 'var(--border-bright)' : 'var(--border)'}`,
                background: filter === f ? 'var(--bg-raised)' : 'transparent',
                color: filter === f ? 'var(--text-primary)' : 'var(--text-muted)',
              }}>{f}</button>
            ))}
          </div>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              {['Coin', 'Status', 'Mentions', 'Sentiment', '24h Price', 'Correlation'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.map((c, i) => (
              <tr key={c.coin_id || i}>
                <td style={{ fontWeight: 600 }}>{c.coin_name}</td>
                <td><Badge prediction={c.prediction} /></td>
                <td style={{ color: 'var(--text-secondary)' }}>{c.reddit_mentions}</td>
                <td>
                  <span style={{ color: c.avg_sentiment >= 0.2 ? '#00ff88' : c.avg_sentiment <= -0.2 ? '#ff3366' : '#ffcc00' }}>
                    {c.avg_sentiment >= 0 ? '+' : ''}{c.avg_sentiment.toFixed(3)}
                  </span>
                </td>
                <td><PriceChange value={c.price_change_24h} /></td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 48, height: 3, background: 'var(--bg-raised)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${Math.abs(c.correlation_score) * 100}%`, height: '100%', borderRadius: 2,
                        background: c.correlation_score > 0 ? '#00ff88' : '#ff3366' }}/>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {c.correlation_score >= 0 ? '+' : ''}{c.correlation_score.toFixed(2)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
