import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function sentimentColor(score) {
  if (score >=  0.2) return '#00ff88';
  if (score <= -0.2) return '#ff3366';
  return '#ffcc00';
}

export default function TrendsPage() {
  const [trends, setTrends]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [hours, setHours]     = useState(24);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`/api/trends?hours=${hours}&limit=15`);
        if (!cancelled) setTrends(res.data.data || []);
      } catch (e) {
        if (!cancelled) setError('Failed to load trends.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetch();
    const t = setInterval(fetch, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(t); };
  }, [hours]);

  const chartData = {
    labels: trends.map(t => t.topic.length > 14 ? t.topic.slice(0, 13) + '…' : t.topic),
    datasets: [{
      label: 'Mentions',
      data: trends.map(t => t.mention_count),
      backgroundColor: trends.map(t => sentimentColor(t.avg_sentiment) + 'bb'),
      borderColor:     trends.map(t => sentimentColor(t.avg_sentiment)),
      borderWidth: 1, borderRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a1a24',
        borderColor: '#3a3a50', borderWidth: 1,
        titleColor: '#e8e8f0', bodyColor: '#8888a8',
        callbacks: {
          afterLabel: ctx => {
            const t = trends[ctx.dataIndex];
            return [
              `Momentum:  ${t.momentum_score.toFixed(3)}`,
              `Sentiment: ${t.avg_sentiment >= 0 ? '+' : ''}${t.avg_sentiment.toFixed(2)}`,
              t.related_coins ? `Coins: ${t.related_coins}` : '',
            ].filter(Boolean);
          },
        },
      },
    },
    scales: {
      x: { ticks: { color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#2a2a38' } },
      y: { ticks: { color: '#8888a8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#2a2a38' } },
    },
  };

  return (
    <div>
      <div className="page-title">Trending Topics</div>
      <div className="page-subtitle">Top topics by Reddit mention count — colour coded by sentiment</div>

      {/* Time filter */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
        {[6, 12, 24, 48].map(h => (
          <button key={h} onClick={() => setHours(h)} style={{
            padding: '4px 12px', borderRadius: '6px', cursor: 'pointer',
            fontFamily: 'var(--font-mono)', fontSize: '11px',
            border: `1px solid ${hours === h ? 'var(--green)' : 'var(--border)'}`,
            background: hours === h ? 'rgba(0,255,136,0.1)' : 'transparent',
            color: hours === h ? 'var(--green)' : 'var(--text-secondary)',
          }}>{h}h</button>
        ))}
      </div>

      {loading ? (
        <div className="loading-state"><div className="dots"><span/><span/><span/></div><div>Loading trends...</div></div>
      ) : error ? (
        <div className="empty-state"><div className="empty-icon">⚠️</div><div>{error}</div></div>
      ) : trends.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div>No trend data yet.</div>
          <div style={{ fontSize: '11px', marginTop: '6px' }}>Run the pipeline to generate trends.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Chart */}
          <div className="card">
            <div className="card-title">Mention Volume</div>
            <div style={{ height: '280px' }}>
              <Bar data={chartData} options={chartOptions} />
            </div>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-title">Trend Details</div>
            <table className="tbl">
              <thead>
                <tr>
                  {['#', 'Topic', 'Mentions', 'Momentum', 'Sentiment', 'Coins'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trends.map((t, i) => {
                  const color = sentimentColor(t.avg_sentiment);
                  const label = t.avg_sentiment >= 0.2 ? 'pos' : t.avg_sentiment <= -0.2 ? 'neg' : 'neutral';
                  return (
                    <tr key={t.id || i}>
                      <td style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{t.topic}</td>
                      <td>{t.mention_count}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: 56, height: 3, background: 'var(--bg-raised)', borderRadius: 2, overflow: 'hidden' }}>
                            <div style={{ width: `${t.momentum_score * 100}%`, height: '100%', background: 'var(--blue)', borderRadius: 2 }} />
                          </div>
                          <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t.momentum_score.toFixed(3)}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${label}`}>
                          {t.avg_sentiment >= 0 ? '+' : ''}{t.avg_sentiment.toFixed(2)}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{t.related_coins || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
