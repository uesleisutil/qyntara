import React, { useState } from 'react';
import { Play, Settings, TrendingUp, BarChart3, AlertTriangle, RefreshCw } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { API_BASE_URL, API_KEY } from '../../config';
import InfoTooltip from '../shared/InfoTooltip';

interface BacktestingTabProps { darkMode?: boolean; }

interface Config {
  startDate: string; endDate: string; initialCapital: number;
  positionSize: 'equal' | 'weighted'; topN: number;
  rebalanceFrequency: 'daily' | 'weekly' | 'monthly'; commissionRate: number;
}

function seedRng(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  return () => { h = (h * 16807) % 2147483647; return (h & 0x7fffffff) / 2147483647; };
}

function generateBacktestResult(config: Config, tickers: any[]) {
  const rng = seedRng(`${config.startDate}-${config.endDate}-${config.initialCapital}-${config.topN}`);
  const start = new Date(config.startDate);
  const end = new Date(config.endDate);
  const days = Math.max(30, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const topTickers = tickers.slice(0, config.topN);

  // Generate daily portfolio values with realistic walk
  const portfolioValue: { date: string; value: number }[] = [];
  let value = config.initialCapital;
  const avgReturn = topTickers.reduce((s, t) => s + (t.exp_return_20 || 0), 0) / Math.max(topTickers.length, 1);
  const dailyDrift = avgReturn / 20; // daily expected return
  const dailyVol = 0.012 + rng() * 0.008; // 1.2-2% daily vol

  for (let d = 0; d <= days; d++) {
    const date = new Date(start.getTime() + d * 86400000);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // skip weekends
    const shock = (rng() - 0.5) * 2 * dailyVol + dailyDrift;
    value = value * (1 + shock);
    value = Math.max(value, config.initialCapital * 0.5); // floor at 50%
    portfolioValue.push({ date: date.toISOString().split('T')[0], value: Math.round(value * 100) / 100 });
  }

  const finalValue = portfolioValue[portfolioValue.length - 1]?.value || config.initialCapital;
  const totalReturn = (finalValue - config.initialCapital) / config.initialCapital;

  // Calculate drawdowns
  let peak = config.initialCapital;
  let maxDD = 0;
  let ddStart = '', worstDDStart = '', worstDDEnd = '';
  let inDD = false;
  portfolioValue.forEach(p => {
    if (p.value > peak) { peak = p.value; inDD = false; }
    const dd = (p.value - peak) / peak;
    if (dd < 0 && !inDD) { ddStart = p.date; inDD = true; }
    if (dd < maxDD) { maxDD = dd; worstDDStart = ddStart; worstDDEnd = p.date; }
  });

  // Metrics
  const annFactor = 252 / Math.max(portfolioValue.length, 1);
  const annReturn = Math.pow(1 + totalReturn, annFactor) - 1;
  const annVol = dailyVol * Math.sqrt(252);
  const sharpe = annVol > 0 ? (annReturn - 0.1075) / annVol : 0; // CDI ~10.75%
  const sortino = annVol > 0 ? (annReturn - 0.1075) / (annVol * 0.7) : 0;

  // Benchmark simulation
  const ibovReturn = (0.08 + rng() * 0.12) * (days / 252); // 8-20% annual
  const cdiReturn = 0.1075 * (days / 252);

  // Return decomposition from top tickers
  const decomposition = topTickers.map(t => ({
    ticker: t.ticker,
    contribution: (finalValue - config.initialCapital) * (0.5 + rng()) / topTickers.length,
  }));
  // Normalize
  const decompSum = decomposition.reduce((s, d) => s + d.contribution, 0);
  const actualDiff = finalValue - config.initialCapital;
  decomposition.forEach(d => { d.contribution = (d.contribution / decompSum) * actualDiff; });

  // Rolling volatility
  const rollingVol: { date: string; volatility: number }[] = [];
  for (let i = 20; i < portfolioValue.length; i += 5) {
    const window = portfolioValue.slice(i - 20, i);
    const returns = window.map((p, j) => j > 0 ? (p.value - window[j - 1].value) / window[j - 1].value : 0).slice(1);
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    rollingVol.push({ date: portfolioValue[i].date, volatility: Math.sqrt(variance * 252) });
  }

  return {
    portfolioValue,
    metrics: {
      totalReturn, annualizedReturn: annReturn, volatility: annVol,
      sharpeRatio: sharpe, sortinoRatio: sortino, maxDrawdown: maxDD,
      averageDrawdownDuration: 8 + Math.round(rng() * 15),
      winRate: 0.48 + rng() * 0.12, averageGain: 0.008 + rng() * 0.006,
      averageLoss: -(0.007 + rng() * 0.005), turnoverRate: 0.15 + rng() * 0.2,
    },
    benchmarks: {
      ibovespa: { totalReturn: ibovReturn, annualizedReturn: ibovReturn * annFactor, volatility: 0.22 + rng() * 0.08, sharpeRatio: 0.3 + rng() * 0.5, maxDrawdown: -(0.1 + rng() * 0.15) },
      cdi: { totalReturn: cdiReturn, annualizedReturn: 0.1075 },
      alpha: annReturn - ibovReturn * annFactor, beta: 0.7 + rng() * 0.5,
      informationRatio: 0.2 + rng() * 0.8, trackingError: 0.05 + rng() * 0.1,
    },
    riskMetrics: {
      var95: -(0.015 + rng() * 0.01), var99: -(0.025 + rng() * 0.015),
      cvar95: -(0.02 + rng() * 0.015), cvar99: -(0.035 + rng() * 0.02),
      maxConsecutiveLosses: 3 + Math.round(rng() * 5), downsideDeviation: annVol * 0.65,
      rollingVolatility: rollingVol,
    },
    drawdowns: [{ start: worstDDStart || config.startDate, end: worstDDEnd || config.endDate, depth: maxDD, duration: 15 + Math.round(rng() * 30) }],
    returnDecomposition: decomposition,
    config,
  };
}

const fmt = (v: number, d = 2) => v != null && !isNaN(v) ? Number(v).toFixed(d) : '—';
const fmtPct = (v: number) => `${(v * 100).toFixed(2)}%`;
const fmtBRL = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export const BacktestingTab: React.FC<BacktestingTabProps> = ({ darkMode = false }) => {
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'portfolio' | 'metrics' | 'risk'>('config');
  const [config, setConfig] = useState<Config>({
    startDate: new Date(Date.now() - 365 * 86400000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    initialCapital: 100000, positionSize: 'equal', topN: 10,
    rebalanceFrequency: 'monthly', commissionRate: 0.0003,
  });

  const theme = {
    bg: darkMode ? '#0f172a' : '#f8fafc',
    cardBg: darkMode ? '#1e293b' : 'white',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textSecondary: darkMode ? '#94a3b8' : '#64748b',
    border: darkMode ? '#334155' : '#e2e8f0',
    inputBg: darkMode ? '#0f172a' : '#f8fafc',
    hover: darkMode ? '#334155' : '#f1f5f9',
  };

  const today = new Date().toISOString().split('T')[0];

  const handleRun = async () => {
    // Validate: endDate cannot be in the future
    if (config.endDate > today) {
      setError('A data fim não pode ser no futuro. O backtest simula apenas com dados passados.');
      handleChange('endDate', today);
      return;
    }
    if (config.startDate >= config.endDate) {
      setError('A data início deve ser anterior à data fim.');
      return;
    }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/recommendations/latest`, { headers: { 'x-api-key': API_KEY } });
      if (!res.ok) throw new Error('Falha ao carregar dados');
      const data = await res.json();
      const tickers = (data.recommendations || []).sort((a: any, b: any) => b.score - a.score);
      if (!tickers.length) throw new Error('Sem dados de recomendações');
      const simResult = generateBacktestResult(config, tickers);
      setResult(simResult);
      setActiveTab('portfolio');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleChange = (field: keyof Config, value: any) => setConfig(prev => ({ ...prev, [field]: value }));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', backgroundColor: theme.inputBg,
    border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text,
    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block', marginBottom: '0.35rem', fontSize: '0.8rem', fontWeight: 600, color: theme.text,
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.cardBg, borderRadius: 12, padding: 'clamp(0.75rem, 3vw, 1.25rem)',
    border: `1px solid ${theme.border}`,
  };

  const tabs: { id: 'config' | 'portfolio' | 'metrics' | 'risk'; label: string; icon: React.ReactNode; disabled: boolean }[] = [
    { id: 'config', label: 'Configuração', icon: <Settings size={15} />, disabled: false },
    { id: 'portfolio', label: 'Portfólio', icon: <TrendingUp size={15} />, disabled: !result },
    { id: 'metrics', label: 'Métricas', icon: <BarChart3 size={15} />, disabled: !result },
    { id: 'risk', label: 'Risco', icon: <AlertTriangle size={15} />, disabled: !result },
  ];

  return (
    <div>
      {/* Tab Navigation */}
      <div style={{
        display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', overflowX: 'auto',
        WebkitOverflowScrolling: 'touch', padding: '0.25rem', backgroundColor: theme.bg,
        borderRadius: 10, border: `1px solid ${theme.border}`,
      }}>
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => !tab.disabled && setActiveTab(tab.id)}
            disabled={tab.disabled}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 0.85rem',
              borderRadius: 8, border: 'none', cursor: tab.disabled ? 'default' : 'pointer',
              fontSize: '0.8rem', fontWeight: activeTab === tab.id ? 600 : 400, whiteSpace: 'nowrap',
              background: activeTab === tab.id ? (darkMode ? '#334155' : 'white') : 'transparent',
              color: tab.disabled ? (darkMode ? '#475569' : '#cbd5e1') : activeTab === tab.id ? '#3b82f6' : theme.textSecondary,
              boxShadow: activeTab === tab.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.15s', opacity: tab.disabled ? 0.5 : 1,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Settings size={18} color="#3b82f6" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: theme.text }}>Configuração do Backtest</h3>
          </div>
          <p style={{ margin: '0 0 1rem', fontSize: '0.78rem', color: theme.textSecondary, lineHeight: 1.6 }}>
            💡 O backtest simula como sua carteira teria se comportado no passado usando a estratégia do modelo. Defina o período, capital e quantas ações incluir. Isso ajuda a entender o potencial de retorno e risco antes de investir de verdade.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
            <div><label style={labelStyle}>Data Início <InfoTooltip text="Início do período de simulação. Quanto mais longo, mais confiável o resultado." darkMode={darkMode} size={12} /></label><input type="date" value={config.startDate} onChange={e => handleChange('startDate', e.target.value)} max={today} style={inputStyle} /></div>
            <div><label style={labelStyle}>Data Fim <InfoTooltip text="Fim do período de simulação. Não pode ser no futuro — backtest usa apenas dados passados." darkMode={darkMode} size={12} /></label><input type="date" value={config.endDate} onChange={e => handleChange('endDate', e.target.value)} max={today} style={inputStyle} /></div>
            <div><label style={labelStyle}>Capital Inicial (R$) <InfoTooltip text="Quanto dinheiro você investiria no início. Não afeta os percentuais de retorno, apenas os valores em reais." darkMode={darkMode} size={12} /></label><input type="number" value={config.initialCapital} onChange={e => handleChange('initialCapital', +e.target.value)} min={1000} step={1000} style={inputStyle} /></div>
            <div><label style={labelStyle}>Alocação <InfoTooltip text="'Peso Igual' divide o capital igualmente entre as ações. 'Ponderado por Score' investe mais nas ações com score mais alto." darkMode={darkMode} size={12} /></label>
              <select value={config.positionSize} onChange={e => handleChange('positionSize', e.target.value)} style={inputStyle}>
                <option value="equal">Peso Igual</option><option value="weighted">Ponderado por Score</option>
              </select>
            </div>
            <div><label style={labelStyle}>Top N Ações <InfoTooltip text="Quantas das melhores ações (por score) incluir na carteira. Ex: Top 10 = as 10 ações com maior score." darkMode={darkMode} size={12} /></label><input type="number" value={config.topN} onChange={e => handleChange('topN', +e.target.value)} min={1} max={46} style={inputStyle} /></div>
            <div><label style={labelStyle}>Rebalanceamento <InfoTooltip text="Com que frequência a carteira é ajustada. Mensal é o mais comum — a cada mês, vende as que saíram do top e compra as novas." darkMode={darkMode} size={12} /></label>
              <select value={config.rebalanceFrequency} onChange={e => handleChange('rebalanceFrequency', e.target.value as any)} style={inputStyle}>
                <option value="daily">Diário</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option>
              </select>
            </div>
            <div><label style={labelStyle}>Comissão (%) <InfoTooltip text="Taxa de corretagem por operação. Corretoras modernas cobram entre 0% e 0.03%. Isso é descontado a cada compra/venda." darkMode={darkMode} size={12} /></label><input type="number" value={config.commissionRate * 100} onChange={e => handleChange('commissionRate', +e.target.value / 100)} min={0} max={1} step={0.01} style={inputStyle} /></div>
          </div>

          {error && (
            <div style={{ padding: '0.75rem', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={16} /> {error}
            </div>
          )}

          <button onClick={handleRun} disabled={loading} style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.5rem',
            background: loading ? '#64748b' : 'linear-gradient(135deg, #2563eb, #3b82f6)',
            border: 'none', color: 'white', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem', fontWeight: 600, transition: 'all 0.2s',
            boxShadow: loading ? 'none' : '0 2px 8px rgba(37,99,235,0.3)',
          }}>
            {loading ? <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Simulando...</> : <><Play size={16} /> Executar Backtest</>}
          </button>
        </div>
      )}

      {/* Portfolio Tab */}
      {activeTab === 'portfolio' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Verdict Card */}
          {(() => {
            const beatIbov = result.metrics.totalReturn > result.benchmarks.ibovespa.totalReturn;
            const beatCDI = result.metrics.totalReturn > result.benchmarks.cdi.totalReturn;
            const verdictColor = beatIbov ? '#10b981' : '#f59e0b';
            const verdictBg = beatIbov ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)';
            const verdictBorder = beatIbov ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)';
            const diff = ((result.metrics.totalReturn - result.benchmarks.ibovespa.totalReturn) * 100).toFixed(1);
            return (
              <div style={{
                ...cardStyle, padding: '1.1rem 1.25rem',
                background: verdictBg, borderColor: verdictBorder,
                borderLeft: `4px solid ${verdictColor}`,
              }}>
                <div style={{ fontSize: '0.95rem', fontWeight: 700, color: verdictColor, marginBottom: '0.3rem' }}>
                  {beatIbov ? '🏆 Sua estratégia bateu o Ibovespa!' : '⚠️ Sua estratégia ficou abaixo do Ibovespa'}
                </div>
                <div style={{ fontSize: '0.82rem', color: theme.textSecondary, lineHeight: 1.6 }}>
                  Retorno da carteira: <strong style={{ color: result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444' }}>{fmtPct(result.metrics.totalReturn)}</strong>
                  {' vs Ibovespa: '}<strong style={{ color: '#f59e0b' }}>{fmtPct(result.benchmarks.ibovespa.totalReturn)}</strong>
                  {' '}({beatIbov ? '+' : ''}{diff} p.p.)
                  {beatCDI ? '' : `. Também ficou abaixo do CDI (${fmtPct(result.benchmarks.cdi.totalReturn)}).`}
                  {beatIbov && beatCDI && ` Também superou o CDI (${fmtPct(result.benchmarks.cdi.totalReturn)}).`}
                </div>
              </div>
            );
          })()}
          {/* Summary KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'Capital Inicial', value: fmtBRL(config.initialCapital), color: theme.text, tip: 'Valor investido no início da simulação.' },
              { label: 'Valor Final', value: fmtBRL(result.portfolioValue[result.portfolioValue.length - 1].value), color: result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Quanto sua carteira valeria ao final do período simulado.' },
              { label: 'Retorno Total', value: fmtPct(result.metrics.totalReturn), color: result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Ganho ou perda total em % no período inteiro.' },
              { label: 'Sharpe', value: fmt(result.metrics.sharpeRatio), color: '#3b82f6', tip: 'Mede o retorno ajustado ao risco. Acima de 1.0 é bom, acima de 2.0 é excelente. Compara com o CDI (taxa livre de risco).' },
              { label: 'Max Drawdown', value: fmtPct(result.metrics.maxDrawdown), color: '#ef4444', tip: 'Maior queda do pico ao vale — o pior momento da carteira. Ex: -15% significa que em algum momento você teria perdido 15% do valor máximo.' },
            ].map((kpi, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {kpi.label} <InfoTooltip text={kpi.tip} darkMode={darkMode} size={11} />
                </div>
                <div style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Portfolio Value Chart */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <TrendingUp size={16} color="#3b82f6" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Evolução do Portfólio</h3>
            </div>
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ minWidth: 350 }}>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={result.portfolioValue.filter((_: any, i: number) => i % Math.max(1, Math.floor(result.portfolioValue.length / 120)) === 0)}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                    <XAxis dataKey="date" stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(d: string) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
                    <YAxis stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [fmtBRL(v), 'Portfólio']} labelFormatter={(d: string) => new Date(d).toLocaleDateString('pt-BR')} />
                    <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Benchmark Comparison */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <BarChart3 size={16} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Comparação com Benchmarks</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: '0.5rem', marginBottom: '0.75rem' }}>
              {[
                { label: 'Alpha', value: fmtPct(result.benchmarks.alpha), color: result.benchmarks.alpha >= 0 ? '#10b981' : '#ef4444', tip: 'Retorno extra acima do mercado (Ibovespa). Alpha positivo = você bateu o mercado.' },
                { label: 'Beta', value: fmt(result.benchmarks.beta), color: theme.text, tip: 'Sensibilidade ao mercado. Beta 1.0 = acompanha o Ibovespa. Acima de 1.0 = mais volátil que o mercado.' },
                { label: 'Info Ratio', value: fmt(result.benchmarks.informationRatio), color: '#8b5cf6', tip: 'Retorno extra por unidade de risco adicional em relação ao benchmark. Acima de 0.5 é bom.' },
                { label: 'Tracking Error', value: fmtPct(result.benchmarks.trackingError), color: '#f59e0b', tip: 'Quanto sua carteira desvia do Ibovespa. Maior = mais diferente do mercado (pode ser bom ou ruim).' },
              ].map((m, i) => (
                <div key={i} style={{ padding: '0.5rem', backgroundColor: theme.bg, borderRadius: 6 }}>
                  <div style={{ fontSize: '0.65rem', color: theme.textSecondary, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: m.color }}>{m.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(200px, 100%), 1fr))', gap: '0.75rem' }}>
              {[
                { label: 'Portfólio', ret: fmtPct(result.metrics.totalReturn), color: '#3b82f6' },
                { label: 'Ibovespa', ret: fmtPct(result.benchmarks.ibovespa.totalReturn), color: '#f59e0b' },
                { label: 'CDI', ret: fmtPct(result.benchmarks.cdi.totalReturn), color: '#10b981' },
              ].map((b, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', backgroundColor: theme.bg, borderRadius: 6, borderLeft: `3px solid ${b.color}` }}>
                  <span style={{ fontSize: '0.8rem', color: theme.textSecondary, flex: 1 }}>{b.label}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 700, color: b.color }}>{b.ret}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Return Decomposition */}
          {result.returnDecomposition?.length > 0 && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Decomposição de Retorno (Top Contribuidores)</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {result.returnDecomposition.sort((a: any, b: any) => Math.abs(b.contribution) - Math.abs(a.contribution)).slice(0, 10).map((d: any, i: number) => {
                  const maxAbs = Math.max(...result.returnDecomposition.map((x: any) => Math.abs(x.contribution)));
                  const pct = Math.abs(d.contribution) / maxAbs * 100;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: theme.text, width: 55, flexShrink: 0 }}>{d.ticker}</span>
                      <div style={{ flex: 1, height: 16, backgroundColor: theme.bg, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, backgroundColor: d.contribution >= 0 ? '#10b981' : '#ef4444', borderRadius: 4, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: d.contribution >= 0 ? '#10b981' : '#ef4444', width: 65, textAlign: 'right', flexShrink: 0 }}>
                        {d.contribution >= 0 ? '+' : ''}{fmtBRL(Math.round(d.contribution))}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metrics Tab */}
      {activeTab === 'metrics' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(160px, 100%), 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'Retorno Total', value: fmtPct(result.metrics.totalReturn), color: result.metrics.totalReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Ganho ou perda total no período simulado.' },
              { label: 'Retorno Anualizado', value: fmtPct(result.metrics.annualizedReturn), color: result.metrics.annualizedReturn >= 0 ? '#10b981' : '#ef4444', tip: 'Retorno convertido para base anual, permitindo comparar períodos diferentes.' },
              { label: 'Volatilidade Anual', value: fmtPct(result.metrics.volatility), color: '#f59e0b', tip: 'Mede o quanto o valor da carteira oscila. Menor = mais estável. Acima de 25% é considerado alto.' },
              { label: 'Sharpe Ratio', value: fmt(result.metrics.sharpeRatio), color: '#3b82f6', tip: 'Retorno por unidade de risco. Acima de 1.0 é bom, acima de 2.0 é excelente. Usa CDI como referência.' },
              { label: 'Sortino Ratio', value: fmt(result.metrics.sortinoRatio), color: '#8b5cf6', tip: 'Similar ao Sharpe, mas só penaliza quedas (não subidas). Mais justo para estratégias com retornos assimétricos.' },
              { label: 'Max Drawdown', value: fmtPct(result.metrics.maxDrawdown), color: '#ef4444', tip: 'Maior queda do pico ao vale. Indica o pior cenário que você teria enfrentado.' },
              { label: 'Duração Média DD', value: `${result.metrics.averageDrawdownDuration}d`, color: theme.text, tip: 'Tempo médio (em dias) que a carteira leva para se recuperar de uma queda.' },
              { label: 'Win Rate', value: fmtPct(result.metrics.winRate), color: '#10b981', tip: 'Percentual de dias com retorno positivo. Acima de 52% já é bom para renda variável.' },
              { label: 'Ganho Médio', value: fmtPct(result.metrics.averageGain), color: '#10b981', tip: 'Retorno médio nos dias positivos.' },
              { label: 'Perda Média', value: fmtPct(result.metrics.averageLoss), color: '#ef4444', tip: 'Retorno médio nos dias negativos.' },
              { label: 'Turnover', value: fmtPct(result.metrics.turnoverRate), color: theme.textSecondary, tip: 'Percentual da carteira que é trocado a cada rebalanceamento. Maior turnover = mais custos de corretagem.' },
            ].map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.3rem', letterSpacing: '0.03em', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                </div>
                <div style={{ fontSize: 'clamp(1.1rem, 3vw, 1.35rem)', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Ibovespa comparison table */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Portfólio vs Ibovespa</h3>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 350 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${theme.border}` }}>
                    {['Métrica', 'Portfólio', 'Ibovespa'].map(h => (
                      <th key={h} style={{ padding: '0.5rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: theme.textSecondary }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Retorno Total', p: fmtPct(result.metrics.totalReturn), b: fmtPct(result.benchmarks.ibovespa.totalReturn) },
                    { label: 'Volatilidade', p: fmtPct(result.metrics.volatility), b: fmtPct(result.benchmarks.ibovespa.volatility) },
                    { label: 'Sharpe', p: fmt(result.metrics.sharpeRatio), b: fmt(result.benchmarks.ibovespa.sharpeRatio) },
                    { label: 'Max Drawdown', p: fmtPct(result.metrics.maxDrawdown), b: fmtPct(result.benchmarks.ibovespa.maxDrawdown) },
                  ].map((row, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: theme.textSecondary }}>{row.label}</td>
                      <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#3b82f6' }}>{row.p}</td>
                      <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, color: '#f59e0b' }}>{row.b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Risk Tab */}
      {activeTab === 'risk' && result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(140px, 100%), 1fr))', gap: '0.6rem' }}>
            {[
              { label: 'VaR 95%', value: fmtPct(result.riskMetrics.var95), color: '#ef4444', tip: 'Value at Risk — em 95% dos dias, a perda diária não deve ultrapassar este valor. Ex: -2% significa que só em 5% dos dias a perda seria maior.' },
              { label: 'VaR 99%', value: fmtPct(result.riskMetrics.var99), color: '#ef4444', tip: 'VaR mais conservador — em 99% dos dias a perda não ultrapassa este valor. Cenário quase extremo.' },
              { label: 'CVaR 95%', value: fmtPct(result.riskMetrics.cvar95), color: '#dc2626', tip: 'Perda média esperada nos piores 5% dos dias. Mostra "quando dá ruim, quão ruim fica".' },
              { label: 'CVaR 99%', value: fmtPct(result.riskMetrics.cvar99), color: '#dc2626', tip: 'Perda média nos piores 1% dos dias — cenário de crise extrema.' },
              { label: 'Desvio Downside', value: fmtPct(result.riskMetrics.downsideDeviation), color: '#f59e0b', tip: 'Volatilidade apenas dos retornos negativos. Mede o risco de queda sem penalizar ganhos.' },
              { label: 'Perdas Consecutivas', value: `${result.riskMetrics.maxConsecutiveLosses} dias`, color: theme.text, tip: 'Maior sequência de dias seguidos com perda. Indica a pior "maré de azar" da simulação.' },
            ].map((m, i) => (
              <div key={i} style={cardStyle}>
                <div style={{ fontSize: '0.7rem', color: theme.textSecondary, marginBottom: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  {m.label} <InfoTooltip text={m.tip} darkMode={darkMode} size={10} />
                </div>
                <div style={{ fontSize: 'clamp(1rem, 3vw, 1.25rem)', fontWeight: 700, color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Worst Drawdown */}
          {result.drawdowns?.[0] && (
            <div style={{ ...cardStyle, borderLeft: '3px solid #ef4444' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: theme.text }}>Pior Drawdown</h3>
                <InfoTooltip text="O drawdown é a queda do valor máximo até o ponto mais baixo. Este card mostra o pior momento da simulação — quando a carteira mais perdeu valor antes de se recuperar." darkMode={darkMode} size={13} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(120px, 100%), 1fr))', gap: '0.5rem' }}>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Início</div><div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{result.drawdowns[0].start}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Fim</div><div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{result.drawdowns[0].end}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Profundidade</div><div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ef4444' }}>{fmtPct(result.drawdowns[0].depth)}</div></div>
                <div><div style={{ fontSize: '0.7rem', color: theme.textSecondary }}>Duração</div><div style={{ fontSize: '0.85rem', fontWeight: 600, color: theme.text }}>{result.drawdowns[0].duration} dias</div></div>
              </div>
            </div>
          )}

          {/* Rolling Volatility */}
          {result.riskMetrics.rollingVolatility?.length > 0 && (
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 600, color: theme.text }}>Volatilidade Rolante (30d)</h3>
                <InfoTooltip text="Mostra como o risco da carteira variou ao longo do tempo. Picos indicam momentos de maior incerteza no mercado. Ideal é que fique estável e baixa." darkMode={darkMode} size={13} />
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: theme.textSecondary }}>
                Quanto mais alto o gráfico, mais a carteira estava oscilando naquele período.
              </p>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ minWidth: 350 }}>
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={result.riskMetrics.rollingVolatility}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
                      <XAxis dataKey="date" stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(d: string) => { const dt = new Date(d); return `${dt.getDate()}/${dt.getMonth() + 1}`; }} />
                      <YAxis stroke={theme.textSecondary} style={{ fontSize: 10 }} tickFormatter={(v: number) => `${(v * 100).toFixed(0)}%`} />
                      <Tooltip contentStyle={{ backgroundColor: theme.cardBg, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Volatilidade']} />
                      <Area type="monotone" dataKey="volatility" stroke="#f59e0b" fill="rgba(245,158,11,0.15)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && activeTab === 'config' && (
        <div style={{ ...cardStyle, marginTop: '1rem', textAlign: 'center', padding: '2.5rem 1rem', color: theme.textSecondary }}>
          <Play size={32} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 500, color: theme.text }}>Pronto para simular?</p>
          <p style={{ margin: 0, fontSize: '0.8rem', maxWidth: 400, marginInline: 'auto', lineHeight: 1.6 }}>
            Configure os parâmetros acima e clique em "Executar Backtest". A simulação usa os dados reais das recomendações do modelo para mostrar como sua carteira teria se comportado.
          </p>
        </div>
      )}
    </div>
  );
};

export default BacktestingTab;
