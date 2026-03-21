import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Search } from 'lucide-react';
import { API_BASE_URL, API_KEY } from '../../config';

interface DashboardContext {
  darkMode: boolean;
  theme: Record<string, string>;
}

const RecommendationsPage: React.FC = () => {
  const { darkMode, theme } = useOutletContext<DashboardContext>();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<string>('rank');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    fetchRecommendations();
  }, []);

  const fetchRecommendations = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/recommendations/latest`, {
        headers: { 'x-api-key': API_KEY },
      });
      if (!response.ok) throw new Error('Falha ao carregar recomendações');
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filtered = recommendations
    .filter(r => !searchTerm || r.ticker?.toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      const val = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'rank') return (a.rank - b.rank) * val;
      if (sortBy === 'score') return (a.score - b.score) * val;
      return 0;
    });

  const cardStyle: React.CSSProperties = {
    background: theme.card || (darkMode ? '#1e293b' : '#fff'),
    border: `1px solid ${theme.border}`,
    borderRadius: 12, padding: '1.25rem',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400, color: theme.textSecondary }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 8 }} />
        Carregando recomendações...
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: theme.text, marginBottom: '0.25rem' }}>Recomendações</h1>
          <p style={{ color: theme.textSecondary, fontSize: '0.875rem' }}>Top ações ranqueadas por Machine Learning</p>
        </div>
        <button onClick={fetchRecommendations} style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem',
          background: 'linear-gradient(135deg, #2563eb, #3b82f6)', border: 'none', color: 'white',
          borderRadius: 8, cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
        }}>
          <RefreshCw size={14} /> Atualizar
        </button>
      </div>

      {error && (
        <div style={{ ...cardStyle, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', marginBottom: '1rem', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total Ações', value: recommendations.length, color: '#3b82f6' },
          { label: 'Score Médio', value: recommendations.length ? (recommendations.reduce((s, r) => s + (r.score || 0), 0) / recommendations.length).toFixed(2) : '—', color: '#10b981' },
          { label: 'Top Score', value: recommendations.length ? Math.max(...recommendations.map(r => r.score || 0)).toFixed(2) : '—', color: '#f59e0b' },
        ].map((kpi, i) => (
          <div key={i} style={cardStyle}>
            <div style={{ fontSize: '0.8rem', color: theme.textSecondary, marginBottom: '0.4rem' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div style={{ ...cardStyle, marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: theme.textSecondary }} />
          <input
            type="text" placeholder="Buscar ticker..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            style={{
              width: '100%', padding: '0.5rem 0.5rem 0.5rem 2rem', background: darkMode ? '#0f172a' : '#f8fafc',
              border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, fontSize: '0.85rem', outline: 'none',
            }}
          />
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{
          padding: '0.5rem 0.75rem', background: darkMode ? '#0f172a' : '#f8fafc',
          border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, fontSize: '0.85rem', outline: 'none',
        }}>
          <option value="rank">Ordenar por Rank</option>
          <option value="score">Ordenar por Score</option>
        </select>
        <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} style={{
          padding: '0.5rem 0.75rem', background: darkMode ? '#0f172a' : '#f8fafc',
          border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, cursor: 'pointer', fontSize: '0.85rem',
        }}>
          {sortDir === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Table */}
      <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                {['Rank', 'Ticker', 'Score', 'Retorno Esperado', 'Confiança', 'Sinal'].map(h => (
                  <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600, color: theme.textSecondary, background: darkMode ? '#0f172a' : '#f8fafc' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: theme.textSecondary }}>Nenhuma recomendação encontrada</td></tr>
              ) : filtered.map((rec, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${theme.border}`, transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = theme.hover}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 28, height: 28, borderRadius: 6, fontSize: '0.8rem', fontWeight: 700,
                      background: i < 3 ? 'linear-gradient(135deg, #2563eb, #3b82f6)' : (darkMode ? '#334155' : '#e2e8f0'),
                      color: i < 3 ? 'white' : theme.text,
                    }}>
                      {rec.rank || i + 1}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem', fontWeight: 600, color: theme.text, fontSize: '0.9rem' }}>{rec.ticker}</td>
                  <td style={{ padding: '0.75rem 1rem', color: '#3b82f6', fontWeight: 600 }}>{rec.score?.toFixed(3) || '—'}</td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: (rec.expected_return || 0) >= 0 ? '#10b981' : '#ef4444' }}>
                      {(rec.expected_return || 0) >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {rec.expected_return ? `${(rec.expected_return * 100).toFixed(1)}%` : '—'}
                    </span>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{ flex: 1, height: 4, borderRadius: 2, background: darkMode ? '#334155' : '#e2e8f0', maxWidth: 80 }}>
                        <div style={{ height: '100%', borderRadius: 2, background: '#3b82f6', width: `${(rec.confidence || 0) * 100}%` }} />
                      </div>
                      <span style={{ fontSize: '0.8rem', color: theme.textSecondary }}>{rec.confidence ? `${(rec.confidence * 100).toFixed(0)}%` : '—'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '0.75rem 1rem' }}>
                    <span style={{
                      padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.75rem', fontWeight: 600,
                      background: rec.signal === 'BUY' ? 'rgba(16,185,129,0.15)' : rec.signal === 'SELL' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
                      color: rec.signal === 'BUY' ? '#10b981' : rec.signal === 'SELL' ? '#ef4444' : '#f59e0b',
                    }}>
                      {rec.signal || 'HOLD'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default RecommendationsPage;
